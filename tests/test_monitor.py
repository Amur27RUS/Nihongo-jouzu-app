import json
import tempfile
import time
import unittest
from pathlib import Path
from server.app import create_app
from tools.collect_monitor import peers_from


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.snapshot = Path(self.temp.name) / 'status.json'
        self.app = create_app({'TESTING': True, 'DATABASE': str(Path(self.temp.name) / 'db.sqlite3'),
                              'MONITOR_FILE': str(self.snapshot), 'MONITOR_ADMINS': set(),
                              'PUBLIC_ORIGIN': 'http://localhost', 'TRUSTED_HOSTS': ['localhost']})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp.cleanup()

    def login_owner(self):
        r = self.client.post('/api/register', json={'login': 'owner', 'code': 'testcode'}, headers={'X-Nihongo-Request': '1'})
        self.assertEqual(r.status_code, 201)
        self.app.config['MONITOR_ADMINS'] = {r.json['user']['id']}

    def data(self, age=0):
        return {'generated_at': time.time()-age, 'vpn': {'peers': [{'endpoint': '192.0.2.1:1234'}]},
                'services': [], 'memory': {}, 'disk': {}, 'history': []}

    def test_unauthenticated_and_normal_accounts_cannot_read_metrics(self):
        self.snapshot.write_text(json.dumps(self.data()))
        self.assertEqual(self.client.get('/api/monitor').status_code, 401)
        self.client.post('/api/register', json={'login': 'learner', 'code': 'testcode'}, headers={'X-Nihongo-Request': '1'})
        r = self.client.get('/api/monitor')
        self.assertEqual(r.status_code, 403)
        self.assertNotIn('192.0.2.1', r.text)

    def test_owner_receives_fresh_snapshot_and_no_cache(self):
        self.login_owner()
        self.snapshot.write_text(json.dumps(self.data()))
        r = self.client.get('/api/monitor')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json['stale'])
        self.assertEqual(r.headers['Cache-Control'], 'no-store')

    def test_stale_missing_and_corrupt_snapshots(self):
        self.login_owner()
        self.assertEqual(self.client.get('/api/monitor').status_code, 503)
        self.snapshot.write_text('{broken')
        self.assertEqual(self.client.get('/api/monitor').status_code, 503)
        self.snapshot.write_text(json.dumps(self.data(120)))
        self.assertTrue(self.client.get('/api/monitor').json['stale'])

    def test_logout_revokes_monitor_access(self):
        self.login_owner()
        self.snapshot.write_text(json.dumps(self.data()))
        self.client.post('/api/logout', json={}, headers={'X-Nihongo-Request': '1'})
        self.assertEqual(self.client.get('/api/monitor').status_code, 401)

    def test_peer_metadata_is_sanitized_and_recency_is_not_online(self):
        peers = peers_from('awg0 public-key-A 900\nawg0 public-key-B 0\nawg0 public-key-C 700',
                           'awg0 public-key-A 1024 2048\nawg0 public-key-B 0 0',
                           'awg0 public-key-A 192.0.2.5:1234\nawg0 public-key-B (none)', 1000)
        self.assertEqual(len(peers), 3)
        self.assertEqual(sum(p['recent'] for p in peers), 1)
        self.assertEqual(peers[0]['received'], 1024)
        self.assertEqual(peers[0]['endpoint'], '192.0.2.5:1234')
        self.assertNotIn('public-key', json.dumps(peers))
        self.assertIsNone(next(p for p in peers if p['last_seen'] is None)['endpoint'])

    def test_user_list_requires_owner_and_excludes_secrets(self):
        self.assertEqual(self.client.get('/api/monitor/users').status_code, 401)
        self.login_owner()
        other = self.app.test_client()
        other.post('/api/register', json={'login': 'learner', 'code': 'secretcode'}, headers={'X-Nihongo-Request': '1'})
        self.assertEqual(other.get('/api/monitor/users').status_code, 403)
        response = self.client.get('/api/monitor/users')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual([u['login'] for u in response.json['users']], ['learner', 'owner'])
        for row in response.json['users']:
            self.assertEqual(set(row), {'login', 'is_owner', 'has_progress', 'is_admin'})
            self.assertEqual(row['is_owner'], row['login'] == 'owner')
            self.assertFalse(row['has_progress'])
        self.client.post('/api/logout', json={}, headers={'X-Nihongo-Request': '1'})
        self.assertEqual(self.client.get('/api/monitor/users').status_code, 401)

    def test_admin_grant_revoke_and_owner_protection(self):
        self.login_owner()
        self.snapshot.write_text(json.dumps(self.data()))
        other = self.app.test_client()
        other.post('/api/register', json={'login': 'learner', 'code': 'secretcode'}, headers={'X-Nihongo-Request': '1'})
        url = '/api/monitor/users/learner/admin'
        headers = {'X-Nihongo-Request': '1'}
        self.assertEqual(other.put(url, json={'enabled': True}, headers=headers).status_code, 403)
        self.assertEqual(self.client.put(url, json={'enabled': True}).status_code, 403)
        self.assertEqual(self.client.put(url, json={'enabled': True}, headers={**headers, 'Origin': 'https://evil.test'}).status_code, 403)
        self.assertEqual(self.client.put(url, json={'enabled': 'yes'}, headers=headers).status_code, 400)
        self.assertEqual(self.client.put('/api/monitor/users/missing/admin', json={'enabled': True}, headers=headers).status_code, 404)
        self.assertEqual(self.client.put('/api/monitor/users/owner/admin', json={'enabled': False}, headers=headers).status_code, 409)
        self.assertEqual(self.client.put(url, json={'enabled': True}, headers=headers).status_code, 200)
        self.assertEqual(other.get('/api/monitor').status_code, 200)
        listing = other.get('/api/monitor/users')
        self.assertFalse(listing.json['can_manage'])
        self.assertTrue(next(u for u in listing.json['users'] if u['login'] == 'learner')['is_admin'])
        self.assertEqual(other.put('/api/monitor/users/owner/admin', json={'enabled': False}, headers=headers).status_code, 403)
        # Role survives application restart and is checked on every request.
        restarted = create_app(dict(self.app.config)).test_client()
        restarted.post('/api/login', json={'login': 'learner', 'code': 'secretcode'}, headers=headers)
        self.assertEqual(restarted.get('/api/monitor').status_code, 200)
        self.assertEqual(self.client.put(url, json={'enabled': False}, headers=headers).status_code, 200)
        self.assertEqual(other.get('/api/monitor').status_code, 403)
        self.assertEqual(restarted.get('/api/monitor/users').status_code, 403)
        self.assertEqual(other.get('/api/session').status_code, 200)
        self.assertTrue(self.client.get('/api/monitor/users').json['can_manage'])

    def test_public_page_has_no_snapshot(self):
        with self.client.get('/status') as r:
            self.assertEqual(r.status_code, 200)
            self.assertNotIn('192.0.2.1:1234', r.text)


if __name__ == '__main__':
    unittest.main()
