import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import request
from server.app import create_app
from tools.backup_db import backup


class DeploymentTests(unittest.TestCase):
    def test_backup_includes_wal_and_is_private(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'live.sqlite3'
            live = sqlite3.connect(source)
            try:
                live.execute('PRAGMA journal_mode=WAL')
                live.execute('CREATE TABLE progress (xp INTEGER)')
                live.execute('INSERT INTO progress VALUES (70)')
                live.commit()
                saved = backup(source, Path(tmp) / 'backups')
                self.assertEqual(saved.stat().st_mode & 0o777, 0o600)
                conn = sqlite3.connect(saved)
                try:
                    self.assertEqual(conn.execute('SELECT xp FROM progress').fetchone()[0], 70)
                finally:
                    conn.close()
            finally:
                live.close()

    def test_forwarded_ip_is_only_trusted_when_enabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            for enabled in (False, True):
                app = create_app({'TESTING': True, 'DATABASE': str(Path(tmp) / 'db.sqlite3'),
                                  'BEHIND_PROXY': enabled, 'TRUSTED_HOSTS': ['localhost']})
                app.add_url_rule('/test-ip', view_func=lambda: request.remote_addr)
                response = app.test_client().get('/test-ip', headers={'X-Forwarded-For': '198.51.100.2'})
                self.assertEqual(response.text, '198.51.100.2' if enabled else '127.0.0.1')

    def test_database_can_live_outside_release_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp) / 'persistent' / 'nihongo.sqlite3')
            with patch.dict(os.environ, {'NIHONGO_DATABASE': db}):
                app = create_app({'TESTING': True})
            self.assertEqual(app.config['DATABASE'], db)
            self.assertTrue(Path(db).is_file())
