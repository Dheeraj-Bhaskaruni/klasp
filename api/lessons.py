"""Lesson CRUD API."""

from flask import Blueprint, request, jsonify
import json
import os
from datetime import datetime
from config import LESSONS_DIR

bp = Blueprint('lessons', __name__, url_prefix='/api/lessons')


def get_lesson_dir(group=None):
    if group and group != '__default__':
        d = os.path.join(LESSONS_DIR, group)
        os.makedirs(d, exist_ok=True)
        return d
    return LESSONS_DIR


def auto_save_progress(session_state):
    """Called by session API to persist learned lines."""
    if session_state.get("lesson_id") and session_state.get("learned"):
        d = get_lesson_dir(session_state.get("group"))
        filepath = os.path.join(d, f"{session_state['lesson_id']}.json")
        if os.path.exists(filepath):
            with open(filepath) as fh:
                data = json.load(fh)
            data["learned"] = sorted(session_state["learned"])
            data["last_used"] = datetime.now().isoformat()
            with open(filepath, "w") as fh:
                json.dump(data, fh, indent=2)


@bp.route('', methods=['GET'])
def list_lessons():
    group = request.args.get("group")
    d = get_lesson_dir(group)
    lessons = []
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            with open(os.path.join(d, f)) as fh:
                data = json.load(fh)
                lessons.append({
                    "id": f[:-5],
                    "name": data["name"],
                    "lines": len(data["lines"]),
                    "learned": data.get("learned", []),
                    "group": data.get("group"),
                    "created": data.get("created", ""),
                    "last_used": data.get("last_used", ""),
                })
    return jsonify(lessons)


@bp.route('', methods=['POST'])
def save_lesson():
    data = request.json
    name = data.get("name", "").strip()
    code = data.get("code", "")
    group = data.get("group")
    lines = [l for l in code.split("\n") if l.strip()]

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not lines:
        return jsonify({"error": "No code provided"}), 400

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in name).strip()
    lesson_id = safe_name.replace(" ", "_").lower()
    if not lesson_id:
        lesson_id = f"lesson_{int(datetime.now().timestamp())}"

    d = get_lesson_dir(group)
    filepath = os.path.join(d, f"{lesson_id}.json")
    now = datetime.now().isoformat()

    existing_learned = []
    existing_created = now
    if os.path.exists(filepath):
        with open(filepath) as fh:
            existing = json.load(fh)
            existing_learned = existing.get("learned", [])
            existing_created = existing.get("created", now)

    lesson = {
        "name": name,
        "lines": lines,
        "learned": existing_learned,
        "group": group,
        "created": existing_created,
        "last_used": now,
    }

    with open(filepath, "w") as fh:
        json.dump(lesson, fh, indent=2)

    return jsonify({"id": lesson_id, "group": group, "message": f"Lesson '{name}' saved."})


@bp.route('/<lesson_id>', methods=['GET'])
def load_lesson(lesson_id):
    group = request.args.get("group")
    d = get_lesson_dir(group)
    filepath = os.path.join(d, f"{lesson_id}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "Lesson not found"}), 404

    with open(filepath) as fh:
        data = json.load(fh)

    data["last_used"] = datetime.now().isoformat()
    with open(filepath, "w") as fh:
        json.dump(data, fh, indent=2)

    return jsonify({
        "id": lesson_id,
        "name": data["name"],
        "code": "\n".join(data["lines"]),
        "group": data.get("group"),
        "learned": data.get("learned", []),
    })


@bp.route('/<lesson_id>', methods=['DELETE'])
def delete_lesson(lesson_id):
    group = request.args.get("group")
    d = get_lesson_dir(group)
    filepath = os.path.join(d, f"{lesson_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
    return jsonify({"message": "Deleted."})


@bp.route('/<lesson_id>/progress', methods=['POST'])
def save_progress(lesson_id):
    group = request.json.get("group")
    d = get_lesson_dir(group)
    filepath = os.path.join(d, f"{lesson_id}.json")
    if not os.path.exists(filepath):
        return jsonify({"error": "Lesson not found"}), 404

    with open(filepath) as fh:
        data = json.load(fh)

    data["learned"] = request.json.get("learned", [])
    data["last_used"] = datetime.now().isoformat()

    with open(filepath, "w") as fh:
        json.dump(data, fh, indent=2)

    return jsonify({"message": "Progress saved."})
