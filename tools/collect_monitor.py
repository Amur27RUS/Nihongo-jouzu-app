#!/usr/bin/env python3
"""Read-only host metrics; writes an atomic snapshot for the unprivileged web app."""
import argparse
import hashlib
import ipaddress
import json
import os
import shutil
import socket
from urllib.parse import urlsplit
import subprocess
import time
import urllib.request
from pathlib import Path

SERVICES = {'amnezia-awg2': 'VPN · AmneziaWG', 'amnezia-dns': 'VPN · DNS',
            'nihongo-jouzu-app-1': 'Nihongo jouzu', 'nihongo-jouzu-web-1': 'HTTPS · Caddy',
            'teamspeak-server': 'TeamSpeak'}


def command(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=8, check=True).stdout


def peers_from(handshakes, transfers, endpoints, now):
    peers = {}
    for line in handshakes.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        iface, key, stamp = parts
        peer_id = hashlib.sha256((iface + ':' + key).encode()).hexdigest()[:12]
        seen = int(stamp)
        peers[(iface, key)] = {'id': peer_id, 'last_seen': seen or None,
                              'recent': bool(seen and 0 <= now - seen <= 180), 'received': 0, 'sent': 0, 'endpoint': None}
    for line in transfers.splitlines():
        parts = line.split()
        if len(parts) == 4 and tuple(parts[:2]) in peers:
            peers[tuple(parts[:2])].update(received=max(0, int(parts[2])), sent=max(0, int(parts[3])))
    for line in endpoints.splitlines():
        parts = line.split()
        if len(parts) == 3 and tuple(parts[:2]) in peers:
            peers[tuple(parts[:2])]['endpoint'] = None if parts[2] == '(none)' else parts[2]
    return sorted(peers.values(), key=lambda p: (not p['recent'], -(p['last_seen'] or 0), p['id']))


def endpoint_ip(endpoint):
    try:
        host = endpoint[1:endpoint.index(']')] if endpoint.startswith('[') else endpoint.rsplit(':', 1)[0]
        address = ipaddress.ip_address(host)
        return str(address) if address.is_global else None
    except (ValueError, AttributeError):
        return None


def locate_peers(peers, previous, now):
    # Cache only current endpoints. Limit lookups so geolocation cannot stall metrics.
    cache = previous.get('geo_cache', {})
    current = {}
    budget = 3
    for peer in peers:
        ip = endpoint_ip(peer.get('endpoint'))
        peer['location'] = None
        if not ip:
            continue
        entry = current.get(ip, cache.get(ip, {}))
        if (entry.get('expires', 0) <= now or entry.get('version') != 2) and budget:
            budget -= 1
            location = entry.get('location')
            ttl = 3600
            try:
                with urllib.request.urlopen('https://ipwho.is/' + ip + '?fields=success,country,region,city,latitude,longitude&lang=ru', timeout=2) as response:
                    data = json.load(response)
                if data.get('success') is True:
                    location = {key: str(data.get(key) or '')[:120] for key in ('country', 'region', 'city')}
                    lat, lon = data.get('latitude'), data.get('longitude')
                    if type(lat) in (int, float) and type(lon) in (int, float) and -90 <= lat <= 90 and -180 <= lon <= 180:
                        location.update(latitude=lat, longitude=lon)
                    ttl = 7 * 86400
            except (OSError, ValueError):
                pass
            entry = {'location': location, 'expires': now + ttl, 'version': 2}
        current[ip] = entry
        peer['location'] = entry.get('location')
    return current


def cpu():
    values = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
    return sum(values), values[3] + values[4]


def fail2ban():
    section = {'available': False}
    try:
        output = command(['fail2ban-client', 'status', 'sshd'])
        stats = {line.split(':', 1)[0].strip('|`- ').strip(): line.split(':', 1)[1].strip()
                 for line in output.splitlines() if ':' in line}
        section = {
            'available': True,
            'currently_failed': int(stats.get('Currently failed', '0') or 0),
            'total_failed': int(stats.get('Total failed', '0') or 0),
            'currently_banned': int(stats.get('Currently banned', '0') or 0),
            'total_banned': int(stats.get('Total banned', '0') or 0),
            'banned_ips': (stats.get('Banned IP list', '') or '').split(),
        }
    except (subprocess.SubprocessError, OSError, ValueError):
        pass
    return section


def collect(previous, url):
    now = time.time()
    before = cpu()
    time.sleep(.2)
    after = cpu()
    elapsed = after[0] - before[0]
    cpu_percent = round(100 * (1 - (after[1] - before[1]) / elapsed), 1) if elapsed else 0
    memory = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines()}
    disk = shutil.disk_usage('/')
    result = {'generated_at': now, 'uptime': float(Path('/proc/uptime').read_text().split()[0]),
              'cpu_percent': cpu_percent, 'cpu_count': os.cpu_count(), 'load': list(os.getloadavg()),
              'memory': {'total': memory['MemTotal'], 'used': memory['MemTotal'] - memory['MemAvailable']},
              'disk': {'total': disk.total, 'used': disk.used, 'free': disk.free}}
    services = {name: {'name': label, 'status': 'unknown'} for name, label in SERVICES.items()}
    try:
        output = command(['docker', 'inspect', '--format', '{{.Name}} {{json .State}}', *SERVICES])
        for line in output.splitlines():
            name, state = line.split(' ', 1)
            state = json.loads(state)
            services[name.lstrip('/')].update(status=state['Status'], health=state.get('Health', {}).get('Status'), started_at=state.get('StartedAt'))
    except (subprocess.SubprocessError, ValueError, KeyError):
        pass
    result['services'] = list(services.values())
    result['security'] = fail2ban()
    try:
        # These commands return public peer metadata only; never use `show ... dump` or private-key.
        outputs = [command(['docker', 'exec', 'amnezia-awg2', 'awg', 'show', 'all', field])
                   for field in ('latest-handshakes', 'transfer', 'endpoints')]
        peers = peers_from(*outputs, now)
        result['vpn'] = {'available': True, 'peers': peers, 'recent_count': sum(p['recent'] for p in peers)}
    except (subprocess.SubprocessError, ValueError):
        result['vpn'] = {'available': False, 'peers': [], 'recent_count': None}
    try:
        server_ip = socket.gethostbyname(urlsplit(url).hostname)
    except OSError:
        server_ip = None
    server_peer = {'endpoint': server_ip + ':443' if server_ip else None}
    banned_stubs = [{'endpoint': ip + ':0'} for ip in result.get('security', {}).get('banned_ips', [])]
    result['geo_cache'] = locate_peers([server_peer, *banned_stubs, *result['vpn']['peers']], previous, now)
    result['server_location'] = server_peer.get('location')
    result['security']['banned'] = [{'ip': stub['endpoint'].rsplit(':', 1)[0], 'location': stub.get('location')} for stub in banned_stubs]
    started = time.monotonic()
    try:
        with urllib.request.urlopen(url.rstrip('/') + '/api/session', timeout=5) as response:
            result['web'] = {'ok': response.status == 200, 'latency_ms': round((time.monotonic() - started) * 1000)}
    except Exception:
        result['web'] = {'ok': False, 'latency_ms': None}
    history = previous.get('history', []) if isinstance(previous, dict) else []
    history = [r for r in history if r.get('time', 0) >= now - 86400]
    history.append({'time': now, 'cpu': cpu_percent, 'memory': round(result['memory']['used'] / result['memory']['total'] * 100, 1),
                    'vpn_recent': result['vpn']['recent_count'], 'web_ok': result['web']['ok']})
    result['history'] = history[-2880:]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--url', required=True)
    args = parser.parse_args()
    output = Path(args.output)
    try:
        previous = json.loads(output.read_text())
    except (OSError, ValueError):
        previous = {}
    result = collect(previous, args.url)
    temporary = output.with_suffix('.tmp')
    with open(temporary, 'w') as file:
        os.chmod(temporary, 0o640)
        json.dump(result, file, ensure_ascii=False, allow_nan=False)
    os.replace(temporary, output)


if __name__ == '__main__':
    main()
