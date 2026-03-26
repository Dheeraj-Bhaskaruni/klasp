"""Authentication API — register, login, logout, session check."""

from flask import Blueprint, request, jsonify, session
import json
import os
import hashlib
import secrets
from config import DATA_DIR

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

USERS_FILE = os.path.join(DATA_DIR, "users.json")


def _load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE) as f:
        return json.load(f)


def _save_users(users):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def _hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return hashed, salt


def require_login(f):
    """Decorator to protect routes."""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        return f(*args, **kwargs)
    return decorated


@bp.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    display_name = data.get("display_name", username)

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    users = _load_users()
    if username in users:
        return jsonify({"error": "Username already taken"}), 400

    hashed, salt = _hash_password(password)
    users[username] = {
        "password": hashed,
        "salt": salt,
        "display_name": display_name,
    }
    _save_users(users)

    session['user'] = username
    session['display_name'] = display_name
    return jsonify({"message": "Account created!", "user": username, "display_name": display_name})


@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")

    users = _load_users()
    if username not in users:
        return jsonify({"error": "Invalid username or password"}), 401

    user = users[username]
    hashed, _ = _hash_password(password, user["salt"])

    if hashed != user["password"]:
        return jsonify({"error": "Invalid username or password"}), 401

    session['user'] = username
    session['display_name'] = user.get("display_name", username)
    return jsonify({"message": "Logged in!", "user": username, "display_name": user.get("display_name", username)})


@bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out."})


@bp.route('/me', methods=['GET'])
def me():
    if 'user' in session:
        return jsonify({"logged_in": True, "user": session['user'], "display_name": session.get('display_name', session['user'])})
    return jsonify({"logged_in": False})
