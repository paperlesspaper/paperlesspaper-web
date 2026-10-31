"""Password login with short-lived, revocable browser sessions."""
from collections import deque
import hashlib
import hmac
import secrets
import threading
import time

from fastapi import HTTPException

COOKIE = 'testbench_session'
SESSION_SECONDS = 12 * 60 * 60


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
    def __init__(self, password_hash):
        self.password_hash = password_hash
        self.lock = threading.Lock()
        self.verify_lock = threading.Lock()
        self.sessions = {}
        self.attempts = {}

    def login(self, password, source):
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
            self.sessions = {k: v for k, v in self.sessions.items() if v > stamp}
            if len(self.sessions) >= 128:
                del self.sessions[min(self.sessions, key=self.sessions.get)]
            self.sessions[hashlib.sha256(token.encode()).digest()] = time.monotonic() + SESSION_SECONDS
            self.attempts.pop(source, None)
        return token

    def valid(self, token):
        if not token or len(token) > 128:
            return False
        key = hashlib.sha256(token.encode()).digest()
        with self.lock:
            expires = self.sessions.get(key, 0)
            if expires <= time.monotonic():
                self.sessions.pop(key, None)
                return False
            return True

    def logout(self, token):
        with self.lock:
            self.sessions.pop(hashlib.sha256(token.encode()).digest(), None)
