# =========================================================================
# FIXTURE: App Python vulnerable con vulnerabilidades OWASP
# =========================================================================

import pickle
import yaml
import os
import subprocess
import sqlite3

# A08: Insecure Deserialization - pickle
def load_user_data(data):
    return pickle.loads(data)

# A08: Insecure YAML loading
def load_config(stream):
    return yaml.load(stream)

# A03: Command Injection via shell
def ping_host(host):
    result = shell_exec(f"ping {host}")
    return result

# A03: SQL Injection
def get_user(user_id):
    conn = sqlite3.connect("app.db")
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return conn.execute(query).fetchone()

# A02: Hardcoded Django secret
SECRET_KEY = 'django-insecure-abc123def456ghi789jkl012mno345pqr678'

# A02: Hardcoded Flask secret
FLASK_SESSION_KEY = 'super-secret-flask-key-that-should-not-be-here'

# A09: Logging sensitive data
import logging
logger = logging.getLogger(__name__)

def login(username, password):
    logger.info(f"Login attempt: {username}, password={password}")
    user = authenticate(username, password)
    if user:
        return create_session(user)
    return None

# A10: SSRF via urllib
import urllib.request
def fetch_page(url):
    return urllib.request.urlopen(url).read()
