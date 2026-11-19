#!/usr/bin/env python3
"""Create a consistent SQLite backup, including committed WAL data.

python3 tools/backup_db.py /var/lib/nihongo-jouzu/nihongo.sqlite3 /path/to/backups
"""
import argparse
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def backup(source, directory):
    source = Path(source).resolve(strict=True)
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target = directory / ('nihongo-' + stamp + '.sqlite3')
    descriptor = os.open(str(target), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(descriptor)
    original = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    saved = sqlite3.connect(target)
    try:
        original.backup(saved)
        if saved.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backup integrity check failed')
    finally:
        saved.close()
        original.close()
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('directory')
    args = parser.parse_args()
    print(backup(args.source, args.directory))
