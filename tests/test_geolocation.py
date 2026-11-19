import io
import json
import unittest
from unittest.mock import patch
from tools.collect_monitor import endpoint_ip, locate_peers


class GeolocationTests(unittest.TestCase):
    def test_public_endpoints_only(self):
        self.assertEqual(endpoint_ip('8.8.8.8:1234'), '8.8.8.8')
        self.assertEqual(endpoint_ip('[2606:4700:4700::1111]:1234'), '2606:4700:4700::1111')
        for endpoint in (None, 'bad', '127.0.0.1:5', '10.0.0.1:5', '[::1]:5'):
            self.assertIsNone(endpoint_ip(endpoint))

    def test_cache_and_duplicate_addresses(self):
        peers = [{'endpoint': '8.8.8.8:1'}, {'endpoint': '8.8.8.8:2'}]
        with patch('tools.collect_monitor.urllib.request.urlopen', return_value=io.BytesIO(json.dumps({'success': True, 'country': 'US', 'city': 'Test'}).encode())) as request:
            cache = locate_peers(peers, {}, 100)
            self.assertEqual(request.call_count, 1)
            self.assertEqual(peers[0]['location']['city'], 'Test')
            locate_peers(peers, {'geo_cache': cache}, 200)
            self.assertEqual(request.call_count, 1)

    def test_failure_backoff_and_lookup_budget(self):
        peers = [{'endpoint': f'8.8.8.{i}:1'} for i in range(1,6)]
        with patch('tools.collect_monitor.urllib.request.urlopen', side_effect=TimeoutError) as request:
            cache = locate_peers(peers, {}, 100)
            self.assertEqual(request.call_count, 3)
            self.assertTrue(all(p['location'] is None for p in peers))
            self.assertEqual(cache['8.8.8.1']['expires'], 3700)

    def test_upgrade_cached_location_with_coordinates(self):
        peers = [{'endpoint': '8.8.8.8:1'}]
        previous = {'geo_cache': {'8.8.8.8': {'expires': 999999, 'location': {'city': 'Old'}}}}
        response = {'success': True, 'city': 'New', 'latitude': 51.5, 'longitude': -0.1}
        with patch('tools.collect_monitor.urllib.request.urlopen', return_value=io.BytesIO(json.dumps(response).encode())) as request:
            cache = locate_peers(peers, previous, 100)
            self.assertEqual(peers[0]['location']['latitude'], 51.5)
            self.assertEqual(cache['8.8.8.8']['version'], 2)
            locate_peers(peers, {'geo_cache': cache}, 200)
            self.assertEqual(request.call_count, 1)

    def test_invalid_coordinates_are_not_used(self):
        for lat, lon in [(100, 0), (0, 190), ('1', 2), (True, 1)]:
            response = {'success': True, 'country': 'Test', 'latitude': lat, 'longitude': lon}
            peers = [{'endpoint': '8.8.8.8:1'}]
            with patch('tools.collect_monitor.urllib.request.urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
                locate_peers(peers, {}, 100)
            self.assertNotIn('latitude', peers[0]['location'])
