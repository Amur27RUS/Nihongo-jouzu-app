"""Nihongo jouzu accounts and progress. Local: python3 -m server.app."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, g, jsonify, request, send_file
from werkzeug.middleware.proxy_fix import ProxyFix

ROOT = Path(__file__).resolve().parent.parent
ITERATIONS = 600_000
SESSION_DAYS = 30
COOKIE = 'nihongo_session'


def valid_progress(s):
    def integer(v):
        return type(v) is int and 0 <= v <= 9_007_199_254_740_991

    def day(v):
        try:
            return isinstance(v, str) and date.fromisoformat(v).isoformat() == v
        except ValueError:
            return False

    def safe(v):
        if isinstance(v, dict):
            return all(k not in ('__proto__', 'constructor', 'prototype') and safe(x) for k, x in v.items())
        return not isinstance(v, list)

    if not isinstance(s, dict) or set(s) != {'v', 'epoch', 'words', 'dev', 'days', 'passed'} or not safe(s) or s.get('v') != 2 or not integer(s.get('epoch')):
        return False
    if not all(isinstance(s.get(k), dict) for k in ('words', 'dev', 'days', 'passed')):
        return False
    for r in s['words'].values():
        if not isinstance(r, dict) or not set(r) <= {'b', 'due', 't', 'm'} or not all(integer(r.get(k)) for k in ('b', 'due', 't')) or r['b'] > 7:
            return False
        if 'm' in r and (type(r['m']) is not int or r['m'] != 1):
            return False
    for r in s['dev'].values():
        if not isinstance(r, dict) or set(r) != {'t', 'd'} or not integer(r.get('t')) or not isinstance(r.get('d'), dict):
            return False
        if not all(day(k) and integer(v) for k, v in r['d'].items()):
            return False
    return all(day(k) and type(v) is int and v == 1 for k, v in s['days'].items()) and all(day(v) for v in s['passed'].values())


def create_app(config=None):
    app = Flask(__name__, static_folder='static', static_url_path='/monitor-assets')
    origin = os.environ.get('NIHONGO_ORIGIN', 'http://127.0.0.1:8765').rstrip('/')
    app.config.update(
        DATABASE=os.environ.get('NIHONGO_DATABASE', str(ROOT / 'instance' / 'nihongo.sqlite3')),
        BEHIND_PROXY=os.environ.get('NIHONGO_BEHIND_PROXY') == '1',
        PUBLIC_ORIGIN=origin,
        COOKIE_SECURE=origin.startswith('https://'),
        MAX_CONTENT_LENGTH=5 * 1024 * 1024,
        TRUSTED_HOSTS=[urlsplit(origin).hostname],
        AUTH_LIMIT=10,
        MONITOR_ADMINS=set(filter(None, os.environ.get('NIHONGO_MONITOR_ADMINS', '').split(','))),
        MONITOR_FILE=os.environ.get('NIHONGO_MONITOR_FILE', '/monitor/status.json'),
    )
    if config:
        app.config.update(config)
    if app.config['BEHIND_PROXY']:
        # Enable only when the app is bound privately behind exactly one trusted proxy.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0, x_port=0, x_prefix=0)
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], timeout=10)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys = ON')
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        conn = g.pop('db', None)
        if conn:
            conn.close()

    with app.app_context():
        db().executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL,
                salt TEXT NOT NULL, code_hash TEXT NOT NULL,
                progress TEXT, revision INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS attempts (
                bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS monitor_admins (
                user_id TEXT PRIMARY KEY REFERENCES users(id),
                granted_by TEXT NOT NULL, granted_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS monitor_access_log (
                actor_id TEXT NOT NULL, target_id TEXT NOT NULL,
                enabled INTEGER NOT NULL, changed_at INTEGER NOT NULL
            );
        ''')
        db().commit()

    def error(key, status):
        return jsonify(error=key), status

    @app.before_request
    def protect_request():
        if request.path.startswith('/api/') and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.headers.get('X-Nihongo-Request') != '1':
                return error('authRequestError', 403)
            # Custom header blocks cross-site form requests; no CORS is enabled.
            if request.headers.get('Origin') not in (None, app.config['PUBLIC_ORIGIN']):
                return error('authRequestError', 403)
            if request.headers.get('Sec-Fetch-Site') == 'cross-site':
                return error('authRequestError', 403)
            if request.mimetype != 'application/json':
                return error('authRequestError', 415)

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        return response

    @app.errorhandler(400)
    @app.errorhandler(413)
    @app.errorhandler(415)
    def invalid_request(_error):
        return error('authRequestError', _error.code)

    @app.get('/')
    @app.get('/index.html')
    def index():
        return send_file(ROOT / 'index.html')

    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def current_user():
        token = request.cookies.get(COOKIE, '')
        if not token or len(token) > 200:
            return None
        return db().execute('''SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE token_hash = ? AND expires > ?''', (digest(token), int(time.time()))).fetchone()

    def identity(user):
        return {'id': user['id'], 'login': user['login']}

    def snapshot(user):
        return {'user': identity(user), 'progress': json.loads(user['progress']) if user['progress'] else None, 'revision': user['revision']}

    def issue_session(user):
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        with db():
            db().execute('DELETE FROM sessions WHERE expires <= ? OR token_hash = ?', (now, digest(request.cookies.get(COOKIE, ''))))
            db().execute('INSERT INTO sessions VALUES (?, ?, ?)', (digest(token), user['id'], now + SESSION_DAYS * 86400))
        response = jsonify(snapshot(user))
        response.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, secure=app.config['COOKIE_SECURE'], samesite='Strict', path='/')
        return response

    def limited(login):
        # Persist limits across restarts; limit by both IP and login. Do not trust X-Forwarded-For.
        now = int(time.time())
        buckets = [('ip:' + (request.remote_addr or ''), app.config['AUTH_LIMIT'] * 5), ('login:' + login, app.config['AUTH_LIMIT'])]
        conn = db()
        conn.execute('BEGIN IMMEDIATE')
        try:
            conn.execute('DELETE FROM attempts WHERE until <= ?', (now,))
            for bucket, limit in buckets:
                row = conn.execute('SELECT count FROM attempts WHERE bucket = ?', (bucket,)).fetchone()
                if row and row['count'] >= limit:
                    conn.commit()
                    return True
            for bucket, _ in buckets:
                conn.execute('''INSERT INTO attempts VALUES (?, 1, ?)
                    ON CONFLICT(bucket) DO UPDATE SET count = count + 1''', (bucket, now + 900))
            conn.commit()
            return False
        except Exception:
            conn.rollback()
            raise

    def credentials():
        data = request.get_json()
        if not isinstance(data, dict):
            return None
        login, code = data.get('login'), data.get('code')
        if not isinstance(login, str) or not isinstance(code, str):
            return None
        login = login.strip().lower()
        if not re.fullmatch(r'[a-z0-9_]{3,32}', login) or not 4 <= len(code) <= 128:
            return None
        return login, code

    def code_hash(code, salt):
        return hashlib.pbkdf2_hmac('sha256', code.encode(), bytes.fromhex(salt), ITERATIONS).hex()

    @app.post('/api/register')
    def register():
        creds = credentials()
        if not creds:
            return error('authInvalidInput', 400)
        login, code = creds
        if limited(login):
            return error('authTooMany', 429)
        salt = secrets.token_hex(16)
        hashed = code_hash(code, salt)
        try:
            with db():
                db().execute('INSERT INTO users (id, login, salt, code_hash) VALUES (?, ?, ?, ?)',
                             (secrets.token_hex(16), login, salt, hashed))
        except sqlite3.IntegrityError:
            return error('authLoginTaken', 409)
        return issue_session(db().execute('SELECT * FROM users WHERE login = ?', (login,)).fetchone()), 201

    @app.post('/api/login')
    def login():
        creds = credentials()
        if not creds:
            return error('authInvalidInput', 400)
        name, code = creds
        if limited(name):
            return error('authTooMany', 429)
        user = db().execute('SELECT * FROM users WHERE login = ?', (name,)).fetchone()
        # Perform the same expensive check for unknown logins.
        hashed = code_hash(code, user['salt'] if user else '00' * 16)
        if not user or not hmac.compare_digest(hashed, user['code_hash']):
            return error('authWrongCode', 401)
        with db():
            db().execute('DELETE FROM attempts WHERE bucket = ?', ('login:' + name,))
        return issue_session(user)

    @app.get('/api/session')
    def session():
        user = current_user()
        return jsonify(snapshot(user)) if user else jsonify(user=None)

    @app.get('/status')
    def monitor_page():
        return send_file(ROOT / 'server' / 'monitor.html')

    def monitor_allowed(user):
        return user['id'] in app.config['MONITOR_ADMINS'] or db().execute(
            'SELECT 1 FROM monitor_admins WHERE user_id = ?', (user['id'],)).fetchone() is not None

    @app.put('/api/monitor/users/<login>/admin')
    def monitor_access(login):
        user = current_user()
        if not user:
            return error('authExpired', 401)
        if user['id'] not in app.config['MONITOR_ADMINS']:
            return error('monitorForbidden', 403)
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or type(payload.get('enabled')) is not bool:
            return error('authRequestError', 400)
        target = db().execute('SELECT id FROM users WHERE login = ?', (login,)).fetchone()
        if not target:
            return error('userNotFound', 404)
        if target['id'] in app.config['MONITOR_ADMINS']:
            return error('ownerProtected', 409)
        now = int(time.time())
        with db():
            if payload['enabled']:
                db().execute('INSERT OR IGNORE INTO monitor_admins VALUES (?, ?, ?)',
                             (target['id'], user['id'], now))
            else:
                db().execute('DELETE FROM monitor_admins WHERE user_id = ?', (target['id'],))
            db().execute('INSERT INTO monitor_access_log VALUES (?, ?, ?, ?)',
                         (user['id'], target['id'], int(payload['enabled']), now))
        return jsonify(ok=True)

    @app.get('/api/monitor/users')
    def monitor_users():
        user = current_user()
        if not user:
            return error('authExpired', 401)
        if not monitor_allowed(user):
            return error('monitorForbidden', 403)
        rows = db().execute('SELECT id, login, progress IS NOT NULL AS has_progress FROM users ORDER BY login COLLATE NOCASE').fetchall()
        admins = {row['user_id'] for row in db().execute('SELECT user_id FROM monitor_admins')}
        return jsonify(can_manage=user['id'] in app.config['MONITOR_ADMINS'],
                       users=[{'login': row['login'], 'has_progress': bool(row['has_progress']),
                               'is_owner': row['id'] in app.config['MONITOR_ADMINS'],
                               'is_admin': row['id'] in admins or row['id'] in app.config['MONITOR_ADMINS']}
                              for row in rows])

    @app.get('/api/monitor')
    def monitor_data():
        user = current_user()
        if not user:
            return error('authExpired', 401)
        if not monitor_allowed(user):
            return error('monitorForbidden', 403)
        try:
            data = json.loads(Path(app.config['MONITOR_FILE']).read_text())
            generated = float(data['generated_at'])
            if not all(k in data for k in ('vpn', 'services', 'memory', 'disk', 'history')):
                raise ValueError('Incomplete snapshot')
        except (OSError, ValueError, KeyError, TypeError):
            return error('monitorUnavailable', 503)
        data.pop('geo_cache', None)
        data['stale'] = time.time() - generated > 90
        data['server_time'] = time.time()
        return jsonify(data)

    @app.post('/api/logout')
    def logout():
        with db():
            db().execute('DELETE FROM sessions WHERE token_hash = ?', (digest(request.cookies.get(COOKIE, '')),))
        response = jsonify(ok=True)
        response.delete_cookie(COOKIE, path='/', secure=app.config['COOKIE_SECURE'], httponly=True, samesite='Strict')
        return response

    @app.route('/api/progress', methods=['GET', 'PUT'])
    def progress():
        user = current_user()
        if not user:
            return error('authExpired', 401)
        # A different tab may have changed the browser's session cookie.
        if request.headers.get('X-Nihongo-User') != user['id']:
            return error('authChanged', 409)
        if request.method == 'GET':
            return jsonify(snapshot(user))
        data = request.get_json()
        if not isinstance(data, dict) or not valid_progress(data.get('progress')) or type(data.get('revision')) is not int:
            return error('authRequestError', 400)
        with db():
            result = db().execute('UPDATE users SET progress = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
                                  (json.dumps(data['progress'], ensure_ascii=False, allow_nan=False), user['id'], data['revision']))
        latest = db().execute('SELECT * FROM users WHERE id = ?', (user['id'],)).fetchone()
        if result.rowcount == 0:
            return jsonify(error='progressConflict', **snapshot(latest)), 409
        return jsonify(snapshot(latest))

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=int(os.environ.get('PORT', '8765')), debug=False)
