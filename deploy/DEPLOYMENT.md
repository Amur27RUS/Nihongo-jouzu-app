# Current deployment

- Published on 2026-11-18: https://78-17-240-144.sslip.io
- VPS: 78.17.240.144, Ubuntu 22.04; application directory `/opt/nihongo-jouzu`.
- Docker Compose project: `nihongo-jouzu`, services `app` and `web` (profile `public`).
- Public ports: 80/443. App port 8000 is internal only. Both services restart automatically.
- SQLite: `/opt/nihongo-jouzu/data/nihongo.sqlite3`, UID/GID 10001.
- Migrated the existing local account and progress; verified against the pre-deploy snapshot.
- Backup schedule: `/etc/cron.d/nihongo-jouzu`, daily 02:17 UTC / 05:17 Moscow.
- Backups: `/opt/nihongo-jouzu/backups`, approximately 30 days retained.
- Backup log: `/var/log/nihongo-jouzu-backup.log`.
- A deployment-day backup was also downloaded to local `instance/vps-backups/` (ignored by Git). Daily backups currently stay on the VPS; recurring off-site backups are not configured.
- Existing Amnezia and TeamSpeak containers were not restarted or modified.

Local edits are not published automatically. Before an update, run `deploy/backup.sh` on the VPS, upload source changes without replacing `.env`, `data/` or `backups/`, then run `docker compose --profile public up -d --build --wait` in the application directory. Verify HTTPS, account login and progress after publishing.

The public URL uses a temporary third-party DNS service. When a registered domain is available, point its A record to the VPS, change `SITE_HOST` in `.env`, and recreate both services. The database stays intact; users sign in again at the new address.

## Private monitor

- URL: `/status`, with API `/api/monitor`.
- Access is restricted to owners listed in `MONITOR_ADMINS` and admins delegated by an owner. New accounts do not get access automatically.
- Host group: `nihongo-monitor`, GID 10001 (create before starting the collector with `getent group 10001 || groupadd --gid 10001 nihongo-monitor`).
- Collector: `/etc/systemd/system/nihongo-monitor.service` and `.timer`; refreshes every 30 seconds.
- Snapshot and rolling 24-hour history: `/opt/nihongo-jouzu/monitor/status.json`, root-owned, group 10001, mode 640. The app mounts this directory read-only.
- Collector reads host metrics, selected container states, public peer metadata and traffic counters. It does not read VPN private keys, capture traffic, or change VPN configuration.
- VPN peer IDs are derived from public keys; recent activity means a handshake within 180 seconds, not a guarantee of a live client connection.
- HTTPS is probed from the VPS itself. This is not an independent external uptime checker. During a complete server outage this dashboard is also unavailable.
- The dashboard reports stale snapshots after 90 seconds. History accumulates from initial deployment; traffic totals reset with interfaces/peers.
- Service diagnostics: `systemctl status nihongo-monitor.timer` and `journalctl -u nihongo-monitor.service`.

- IP geolocation: ipwho.is over HTTPS (owner consent received). Public endpoint IPs only; country/region/city cached 7 days, failures retried after 1 hour, at most 3 lookups per collection. Cache is excluded from the API response. Location is approximate and may describe the ISP.
- Interactive CPU/memory chart: 1/6/24-hour windows, pointer and arrow-key inspection; collection every 30 seconds, gaps over 90 seconds are not connected.

- 3D globe: self-hosted Three.js 0.170.0 and OrbitControls (MIT), Natural Earth land outlines (public domain), assets under `/monitor-assets/`. No browser requests to third-party CDNs.
- Geolocation cache schema v2 adds validated latitude/longitude and the VPS location, refreshing older entries within the existing lookup budget. Clients without coordinates remain in the table.
- Globe pauses offscreen/in hidden tabs, groups equal coordinates, clears client objects on logout, and falls back to the table when WebGL is unavailable. Arcs are illustrative, not network routes.

## Delegated monitoring access

`MONITOR_ADMINS` remains the protected owner allowlist. Owners can grant/revoke read access to the complete dashboard for existing accounts in the Nihongo jouzu tab. Delegated roles persist in SQLite table `monitor_admins`; changes are recorded in `monitor_access_log`. Delegated admins cannot grant roles or change owners. Each API request checks the current role, so revocation does not require session invalidation. The learning app remains available to a revoked admin.

The VPN privacy checkbox hides IPs and location names, while retaining geographic points and connection arcs on the globe. It does not hide approximate positions on the map. Clients without coordinates remain in the table.
