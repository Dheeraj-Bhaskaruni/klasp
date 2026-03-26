#!/bin/bash
# Klasp - Local server launcher

PORT=5002
HOST=0.0.0.0

echo ""
echo "  Klasp"
echo "  ==================="
echo "  Local:   http://localhost:$PORT"
echo "  Network: http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
echo ""

cd "$(dirname "$0")"

if command -v gunicorn &>/dev/null; then
    echo "  Starting with gunicorn..."
    gunicorn "app:create_app()" --bind "$HOST:$PORT" --workers 1 --threads 4 --timeout 120
else
    echo "  Starting with Flask dev server..."
    python app.py
fi
