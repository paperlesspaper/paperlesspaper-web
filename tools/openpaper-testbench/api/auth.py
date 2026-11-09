"""Revocable browser sessions; remembered tokens survive service restarts."""
from collections import deque
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import secrets
import threading
import time

from fastapi import HTTPException

COOKIE = 'testbench_session'
SESSION_SECONDS = 12 * 60 * 60
REMEMBER_SECONDS = 30 * 24 * 60 * 60


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return f'scrypt${salt.hex()}${digest.hex()}'


def verify_password(password, encoded):
    try:
        algorithm, salt, expected = encoded.split('$')
        if algorithm != 'scrypt' or len(salt) != 32 or len(expected) != 64:
            return False
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(digest, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


class WebAuth:
    def __init__(self, password_hash, sessions_file=None):
        self.password_hash = password_hash
        self.lock = threading.Lock()
        self.verify_lock = threading.Lock()
        self.sessions = {}
        self.remembered = set()
        self.sessions_file = Path(sessions_file) if sessions_file else None
        self.attempts = {}
        if self.sessions_file:
            try:
                data = json.loads(self.sessions_file.read_text())
                if data.get('password_version') == self.password_version():
                    for key, expires in data.get('sessions', {}).items():
                        # A Pi may boot before NTP restores its clock. A valid
                        # expiry can then be more than 30 days in the future.
                        if len(key) == 64 and type(expires) in (int, float) and math.isfinite(expires) and time.time() < expires:
                            digest = bytes.fromhex(key)
                            self.sessions[digest] = expires
                            self.remembered.add(digest)
            except (OSError, ValueError, TypeError, AttributeError):
                self.sessions.clear()
                self.remembered.clear()

    def password_version(self):
        return hashlib.sha256(self.password_hash.encode()).hexdigest()

    def save_sessions(self):
        # Caller holds self.lock. Never persist bearer tokens or passwords.
        if not self.sessions_file:
            return
        data = {'password_version': self.password_version(), 'sessions': {
            key.hex(): expires for key, expires in self.sessions.items()
            if key in self.remembered and expires > time.time()}}
        self.sessions_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.sessions_file.with_suffix('.tmp')
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as out:
            os.fchmod(out.fileno(), 0o600)
            json.dump(data, out)
            out.flush()
            os.fsync(out.fileno())
        tmp.replace(self.sessions_file)

    def login(self, password, source, remember=False):
        if not self.password_hash:
            raise HTTPException(503, 'Web-Passwort ist noch nicht eingerichtet')
        stamp = time.monotonic()
        with self.lock:
            self.attempts = {k: v for k, v in self.attempts.items() if v and v[-1] > stamp - 60}
            if source not in self.attempts and len(self.attempts) >= 1024:
                raise HTTPException(429, 'Bitte nach einer Minute erneut versuchen', headers={'Retry-After': '60'})
            attempts = self.attempts.setdefault(source, deque())
            while attempts and attempts[0] <= stamp - 60:
                attempts.popleft()
            if len(attempts) >= 5:
                raise HTTPException(429, 'Zu viele Anmeldeversuche. Bitte eine Minute warten.', headers={'Retry-After': '60'})
            attempts.append(stamp)
        # Bound memory/CPU on the Pi when several logins arrive concurrently.
        with self.verify_lock:
            if not verify_password(password, self.password_hash):
                raise HTTPException(401, 'Passwort falsch')
        token = secrets.token_urlsafe(32)
        with self.lock:
            self.sessions = {k: v for k, v in self.sessions.items() if v > time.time()}
            if len(self.sessions) >= 128:
                del self.sessions[min(self.sessions, key=self.sessions.get)]
            self.remembered.intersection_update(self.sessions)
            key = hashlib.sha256(token.encode()).digest()
            self.sessions[key] = time.time() + (REMEMBER_SECONDS if remember else SESSION_SECONDS)
            if remember:
                self.remembered.add(key)
            self.save_sessions()
            self.attempts.pop(source, None)
        return token

    def valid(self, token):
        if not token or len(token) > 128:
            return False
        key = hashlib.sha256(token.encode()).digest()
        with self.lock:
            expires = self.sessions.get(key, 0)
            if expires <= time.time():
                self.sessions.pop(key, None)
                if key in self.remembered:
                    self.remembered.discard(key)
                    self.save_sessions()
                return False
            return True

    def logout(self, token):
        with self.lock:
            key = hashlib.sha256(token.encode()).digest()
            self.sessions.pop(key, None)
            self.remembered.discard(key)
            self.save_sessions()
