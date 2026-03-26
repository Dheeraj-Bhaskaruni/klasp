"""Groups API — organize lessons into categories."""

from flask import Blueprint, request, jsonify
import os
import shutil
from config import LESSONS_DIR

bp = Blueprint('groups', __name__, url_prefix='/api/groups')


@bp.route('', methods=['GET'])
def list_groups():
    groups = [{"id": "__default__", "name": "Ungrouped"}]
    for name in sorted(os.listdir(LESSONS_DIR)):
        path = os.path.join(LESSONS_DIR, name)
        if os.path.isdir(path):
            count = len([f for f in os.listdir(path) if f.endswith(".json")])
            groups.append({"id": name, "name": name.replace("_", " ").title(), "count": count})
    groups[0]["count"] = len([f for f in os.listdir(LESSONS_DIR) if f.endswith(".json")])
    return jsonify(groups)


@bp.route('', methods=['POST'])
def create_group():
    name = request.json.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    safe = "".join(c if c.isalnum() or c in "-_ " else "" for c in name).strip()
    group_id = safe.replace(" ", "_").lower()
    if not group_id:
        return jsonify({"error": "Invalid name"}), 400
    os.makedirs(os.path.join(LESSONS_DIR, group_id), exist_ok=True)
    return jsonify({"id": group_id, "name": name})


@bp.route('/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    path = os.path.join(LESSONS_DIR, group_id)
    if os.path.isdir(path):
        shutil.rmtree(path)
    return jsonify({"message": "Deleted."})
