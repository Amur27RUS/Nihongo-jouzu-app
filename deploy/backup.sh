#!/bin/sh
set -eu
cd /opt/nihongo-jouzu
/usr/bin/docker compose exec -T app python tools/backup_db.py /data/nihongo.sqlite3 /backups
# Remove only this application's snapshots older than 30 days, after a successful backup.
find /opt/nihongo-jouzu/backups -maxdepth 1 -type f -name 'nihongo-*.sqlite3' -mtime +30 -delete
