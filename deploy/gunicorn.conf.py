# Only the local HTTPS reverse proxy may reach this listener.
bind = '127.0.0.1:8765'
workers = 2
worker_class = 'gthread'
threads = 2
timeout = 30
graceful_timeout = 30
preload_app = True
max_requests = 1000
max_requests_jitter = 100
accesslog = '-'
errorlog = '-'
