"""App configuration."""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
LESSONS_DIR = os.path.join(BASE_DIR, "lessons")

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(LESSONS_DIR, exist_ok=True)

SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-in-production-" + os.urandom(8).hex())
