import json
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from server.app import create_app, COOKIE


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.database = str(Path(self.tmp.name) / 'test.sqlite3')
        self.app = create_app({'TESTING': True, 'DATABASE': self.database, 'PUBLIC_ORIGIN': 'http://localhost', 'TRUSTED_HOSTS': ['localhost']})
        self.client = self.app.test_client()
        self.headers = {'X-Nihongo-Request': '1', 'Origin': 'http://localhost'}

    def tearDown(self):
        self.tmp.cleanup()

    def post(self, path, data, client=None, headers=None):
        return (client or self.client).post('/api/' + path, json=data, headers=self.headers if headers is None else headers)

    def register(self, name='learner', client=None):
        r = self.post('register', {'login': name, 'code': 'secret-code-123'}, client)
        self.assertEqual(r.status_code, 201)
        return r.json['user']

    def progress(self, xp=10):
        return {'v': 2, 'epoch': 0, 'words': {'ねこ|猫': {'b': 3, 'due': 20000, 't': 1000, 'm': 1}},
                'dev': {'device': {'t': xp, 'd': {'2026-11-18': xp}}}, 'days': {'2026-11-18': 1}, 'passed': {}}

    def put(self, user, progress, revision=0, client=None):
        return (client or self.client).put('/api/progress', json={'progress': progress, 'revision': revision},
                                         headers={**self.headers, 'X-Nihongo-User': user['id']})

    def test_register_login_logout_and_session_revocation(self):
        user = self.register(' Learner ')
        self.assertEqual(user['login'], 'learner')
        self.assertEqual(self.client.get('/api/session').json['user'], user)
        token = self.client.get_cookie(COOKIE).value
        self.assertEqual(self.post('logout', {}).status_code, 200)
        self.client.set_cookie(COOKIE, token)
        self.assertIsNone(self.client.get('/api/session').json['user'])
        self.assertEqual(self.post('login', {'login': 'LEARNER', 'code': 'wrong-code'}).status_code, 401)
        r = self.post('login', {'login': 'LEARNER', 'code': 'secret-code-123'})
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(self.client.get_cookie(COOKIE).value, token)
        self.assertIn('HttpOnly', r.headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', r.headers['Set-Cookie'])

    def test_codes_are_salted_and_sessions_are_hashed(self):
        self.register('learner1')
        self.register('learner2')
        token = self.client.get_cookie(COOKIE).value
        with sqlite3.connect(self.database) as db:
            rows = db.execute('SELECT salt, code_hash FROM users').fetchall()
            self.assertNotEqual(rows[0][0], rows[1][0])
            self.assertNotEqual(rows[0][1], rows[1][1])
            self.assertNotIn('secret-code-123', str(rows))
            self.assertNotIn(token, str(db.execute('SELECT * FROM sessions').fetchall()))

    def test_unique_case_insensitive_login_and_input_limits(self):
        self.register()
        self.assertEqual(self.post('register', {'login': 'LEARNER', 'code': 'secret-code-123'}).status_code, 409)
        for login, code in [('ab', 'long-code'), ('bad name', 'long-code'), ('японский', 'long-code'), ('valid', '123'), ('valid', 'x' * 129)]:
            self.assertEqual(self.post('register', {'login': login, 'code': code}).status_code, 400)
        self.assertEqual(self.post('register', []).status_code, 400)

    def test_four_character_code_registration_and_login(self):
        creds = {'login': 'shortcode', 'code': '1234'}
        self.assertEqual(self.post('register', creds).status_code, 201)
        self.post('logout', {})
        self.assertEqual(self.post('login', creds).status_code, 200)
        self.assertEqual(self.post('login', {**creds, 'code': '123'}).status_code, 400)

    def test_progress_is_private_and_persists_across_server_restart(self):
        a = self.register('learner1')
        other = self.app.test_client()
        b = self.register('learner2', other)
        self.assertEqual(self.put(a, self.progress()).status_code, 200)
        self.assertEqual(other.get('/api/progress', headers={'X-Nihongo-User': a['id']}).status_code, 409)
        self.assertIsNone(other.get('/api/progress', headers={'X-Nihongo-User': b['id']}).json['progress'])
        self.assertEqual(self.put(a, self.progress(999), client=other).status_code, 409)
        app2 = create_app({'TESTING': True, 'DATABASE': self.database, 'PUBLIC_ORIGIN': 'http://localhost', 'TRUSTED_HOSTS': ['localhost']})
        client2 = app2.test_client()
        client2.set_cookie(COOKIE, self.client.get_cookie(COOKIE).value)
        self.assertEqual(client2.get('/api/progress', headers={'X-Nihongo-User': a['id']}).json['progress'], self.progress())
        self.assertEqual(self.app.test_client().get('/api/progress').status_code, 401)

    def test_revision_conflict_does_not_overwrite_newer_progress(self):
        user = self.register()
        self.assertEqual(self.put(user, self.progress()).json['revision'], 1)
        stale = self.put(user, self.progress(99), revision=0)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json['error'], 'progressConflict')
        self.assertEqual(stale.json['progress'], self.progress())
        self.assertEqual(self.put(user, self.progress(99), revision=1).json['revision'], 2)

    def test_rejects_invalid_progress_and_prototype_keys(self):
        user = self.register()
        invalid = [None, [], {}, {**self.progress(), 'epoch': -1}, {**self.progress(), 'words': {'__proto__': {}}},
                   {**self.progress(), 'days': {'2026-02-30': 1}}, {**self.progress(), 'dev': {'x': {'t': float('inf'), 'd': {}}}}]
        for progress in invalid:
            self.assertEqual(self.put(user, progress).status_code, 400)
        self.assertIsNone(self.client.get('/api/session').json['progress'])

    def test_csrf_and_static_file_allowlist(self):
        data = {'login': 'learner', 'code': 'secret-code-123'}
        self.assertEqual(self.post('register', data, headers={}).status_code, 403)
        self.assertEqual(self.post('register', data, headers={**self.headers, 'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.post('register', data, headers={**self.headers, 'Sec-Fetch-Site': 'cross-site'}).status_code, 403)
        for path in ['/instance/nihongo.sqlite3', '/.git/config', '/server/app.py', '/../instance/nihongo.sqlite3']:
            self.assertEqual(self.client.get(path).status_code, 404)
        with self.client.get('/') as response:
            self.assertEqual(response.status_code, 200)

    def test_rate_limit_and_expired_session(self):
        self.app.config['AUTH_LIMIT'] = 2
        user = self.register()
        self.assertEqual(self.post('login', {'login': 'learner', 'code': 'wrong-code'}).status_code, 401)
        self.assertEqual(self.post('login', {'login': 'learner', 'code': 'wrong-code'}).status_code, 429)
        with sqlite3.connect(self.database) as db:
            db.execute('UPDATE sessions SET expires = ?', (int(time.time()) - 1,))
        self.assertIsNone(self.client.get('/api/session').json['user'])
        self.assertEqual(self.put(user, self.progress()).status_code, 401)

    def test_secure_cookie_for_https(self):
        self.app.config.update(COOKIE_SECURE=True, PUBLIC_ORIGIN='https://localhost')
        r = self.client.post('/api/register', base_url='https://localhost', json={'login': 'learner', 'code': 'secret-code-123'},
                             headers={**self.headers, 'Origin': 'https://localhost'})
        self.assertEqual(r.status_code, 201)
        self.assertIn('Secure;', r.headers['Set-Cookie'])


if __name__ == '__main__':
    unittest.main()
