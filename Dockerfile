FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
COPY deploy/requirements.txt deploy/requirements.txt
RUN pip install --no-cache-dir -r deploy/requirements.txt \
    && groupadd --gid 10001 nihongo \
    && useradd --uid 10001 --gid nihongo --no-create-home nihongo
COPY server/ server/
COPY tools/backup_db.py tools/backup_db.py
COPY deploy/gunicorn.conf.py deploy/gunicorn.conf.py
COPY index.html ./
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn", "-c", "deploy/gunicorn.conf.py", "--bind", "0.0.0.0:8000", "server.app:create_app()"]
