"""
Klasp - Web UI with continuous listening.
Flask server. Supports two TTS modes:
  - "browser" (default): returns spoken text, browser uses speechSynthesis (works everywhere)
  - "server": macOS 'say' command (offline, Mac only, synchronous)
Browser Speech API or text input for commands.
Lessons organized in groups.
"""

from flask import Flask, render_template, request, jsonify
import subprocess
import json
import os
import platform
from datetime import datetime
from teach import code_to_speech, parse_command

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LESSONS_DIR = os.path.join(BASE_DIR, "lessons")
os.makedirs(LESSONS_DIR, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.environ.get("SECRET_KEY", "klasp-dev-key")

# ── Session state ─────────────────────────────────────────────────────────

session = {
    "lines": [],
    "current": 0,
    "learned": set(),
    "rate": 160,
    "active": False,
    "lesson_id": None,
    "group": None,
    "tts_mode": "browser",
}

speak_queue = []


def speak(text: str):
    if session["tts_mode"] == "server" and platform.system() == "Darwin":
        subprocess.run(["say", "-v", "Samantha", "-r", str(session["rate"]), text])
    else:
        speak_queue.append(text)


def speak_line(idx: int):
    total = len(session["lines"])
    spoken = code_to_speech(session["lines"][idx])
    speak(f"Line {idx + 1} of {total}: {spoken}")


def get_lesson_dir(group=None):
    if group:
        d = os.path.join(LESSONS_DIR, group)
        os.makedirs(d, exist_ok=True)
        return d
    return LESSONS_DIR


def auto_save_progress():
    if session["lesson_id"] and session["learned"]:
        d = get_lesson_dir(session["group"])
        filepath = os.path.join(d, f"{session['lesson_id']}.json")
        if os.path.exists(filepath):
            with open(filepath) as fh:
                data = json.load(fh)
            data["learned"] = sorted(session["learned"])
            data["last_used"] = datetime.now().isoformat()
            with open(filepath, "w") as fh:
                json.dump(data, fh, indent=2)


def get_state():
    auto_save_progress()
    return {
        "lines": [
            {
                "number": i + 1,
                "code": line,
                "spoken": code_to_speech(line),
                "learned": i in session["learned"],
                "current": i == session["current"],
            }
            for i, line in enumerate(session["lines"])
        ],
        "current": session["current"] + 1,
        "total": len(session["lines"]),
        "learned_count": len(session["learned"]),
        "rate": session["rate"],
        "active": session["active"],
        "tts_mode": session["tts_mode"],
    }


def make_response(extra=None):
    state = get_state()
    if extra:
        state.update(extra)
    state["speak_queue"] = list(speak_queue)
    speak_queue.clear()
    return state


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    has_say = platform.system() == "Darwin"
    return render_template("index.html", has_server_tts=has_say)


@app.route("/api/start", methods=["POST"])
def start_session():
    data = request.json
    code = data.get("code", "")
    lines = [l for l in code.split("\n") if l.strip()]

    if not lines:
        return jsonify({"error": "No code provided"}), 400

    session["lines"] = lines
    session["current"] = 0
    session["learned"] = set()
    session["rate"] = 160
    session["active"] = True
    session["lesson_id"] = data.get("lesson_id")
    session["group"] = data.get("group")
    session["tts_mode"] = data.get("tts_mode", "browser")
    speak_queue.clear()

    speak(f"I have {len(lines)} lines to teach you. Let's begin!")
    speak_line(0)

    return jsonify(make_response({"message": "Session started. Say next, repeat, or done."}))


@app.route("/api/command", methods=["POST"])
def handle_command():
    data = request.json
    cmd_text = data.get("command", "").lower().strip()

    if not session["active"] or not session["lines"]:
        return jsonify({"error": "No active session"}), 400

    speak_queue.clear()
    total = len(session["lines"])
    current = session["current"]
    cmd = parse_command(cmd_text, current + 1, total)
    action = cmd["action"]
    message = ""

    if action == "next":
        session["learned"].add(current)
        session["current"] += 1
        if session["current"] < total:
            speak_line(session["current"])
            message = "Next line."
        else:
            speak(f"All {total} lines done! You learned {len(session['learned'])} lines. Great job!")
            message = f"All done! Learned {len(session['learned'])}/{total} lines."
            session["active"] = False

    elif action == "repeat":
        times = cmd.get("times", 1)
        for i in range(times):
            if times > 1:
                speak(f"Time {i + 1}.")
            speak_line(current)
        message = f"Repeated {times} time{'s' if times > 1 else ''}."

    elif action == "goto":
        target = cmd["line"] - 1
        times = cmd.get("times", 1)
        session["current"] = target
        for i in range(times):
            if times > 1:
                speak(f"Time {i + 1}.")
            speak_line(target)
        message = f"Line {cmd['line']}."

    elif action == "previous":
        if current > 0:
            session["current"] -= 1
            speak_line(session["current"])
            message = "Previous line."
        else:
            speak("Already at the first line.")
            message = "Already at line 1."

    elif action == "read_all":
        speak("Reading all remaining lines.")
        for i in range(session["current"], total):
            speak_line(i)
        session["current"] = total
        session["active"] = False
        message = "Read all lines."

    elif action == "faster":
        session["rate"] = min(session["rate"] + 30, 300)
        speak("Faster.")
        message = f"Speed: {session['rate']}"

    elif action == "slower":
        session["rate"] = max(session["rate"] - 30, 100)
        speak("Slower.")
        message = f"Speed: {session['rate']}"

    elif action == "done":
        learned_count = len(session["learned"])
        speak(f"Session ended. You learned {learned_count} out of {total} lines.")
        session["active"] = False
        message = f"Done! Learned {learned_count}/{total}."

    elif action == "error":
        speak(cmd["msg"])
        message = cmd["msg"]

    else:
        speak("Say next, repeat, repeat 3 times, go to line 5, or done.")
        message = "Didn't catch that."

    return jsonify(make_response({"message": message}))


@app.route("/api/speak-line", methods=["POST"])
def speak_line_route():
    data = request.json
    line_num = data.get("line", session["current"] + 1)
    times = data.get("times", 1)

    if not session["lines"]:
        return jsonify({"error": "No session"}), 400

    idx = line_num - 1
    if idx < 0 or idx >= len(session["lines"]):
        return jsonify({"error": "Invalid line number"}), 400

    speak_queue.clear()
    session["current"] = idx
    for i in range(times):
        if times > 1:
            speak(f"Time {i + 1}.")
        speak_line(idx)

    return jsonify(make_response())


@app.route("/api/end", methods=["POST"])
def end_session():
    learned = len(session["learned"])
    total = len(session["lines"])
    session["active"] = False
    speak_queue.clear()
    speak(f"Session ended. You learned {learned} out of {total} lines.")
    return jsonify(make_response())


@app.route("/api/tts-mode", methods=["POST"])
def set_tts_mode():
    mode = request.json.get("mode", "browser")
    if mode not in ("browser", "server"):
        return jsonify({"error": "Invalid mode"}), 400
    session["tts_mode"] = mode
    return jsonify({"tts_mode": mode})


# ── Groups ────────────────────────────────────────────────────────────────

@app.route("/api/groups", methods=["GET"])
def list_groups():
    groups = [{"id": "__default__", "name": "Ungrouped"}]
    for name in sorted(os.listdir(LESSONS_DIR)):
        path = os.path.join(LESSONS_DIR, name)
        if os.path.isdir(path):
            count = len([f for f in os.listdir(path) if f.endswith(".json")])
            groups.append({"id": name, "name": name.replace("_", " ").title(), "count": count})
    # Count ungrouped lessons
    groups[0]["count"] = len([f for f in os.listdir(LESSONS_DIR) if f.endswith(".json")])
    return jsonify(groups)


@app.route("/api/groups", methods=["POST"])
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


@app.route("/api/groups/<group_id>", methods=["DELETE"])
def delete_group(group_id):
    import shutil
    path = os.path.join(LESSONS_DIR, group_id)
    if os.path.isdir(path):
        shutil.rmtree(path)
    return jsonify({"message": "Deleted."})


# ── Lesson storage ────────────────────────────────────────────────────────

@app.route("/api/lessons", methods=["GET"])
def list_lessons():
    group = request.args.get("group")
    d = get_lesson_dir(group if group != "__default__" else None)
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


@app.route("/api/lessons", methods=["POST"])
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

    d = get_lesson_dir(group if group != "__default__" else None)
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


@app.route("/api/lessons/<lesson_id>", methods=["GET"])
def load_lesson(lesson_id):
    group = request.args.get("group")
    d = get_lesson_dir(group if group != "__default__" else None)
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


@app.route("/api/lessons/<lesson_id>", methods=["DELETE"])
def delete_lesson(lesson_id):
    group = request.args.get("group")
    d = get_lesson_dir(group if group != "__default__" else None)
    filepath = os.path.join(d, f"{lesson_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
    return jsonify({"message": "Deleted."})


@app.route("/api/lessons/<lesson_id>/progress", methods=["POST"])
def save_progress(lesson_id):
    group = request.json.get("group")
    d = get_lesson_dir(group if group != "__default__" else None)
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


if __name__ == "__main__":
    print("\n  Klasp")
    print("  Open http://localhost:5002 in your browser\n")
    app.run(debug=True, port=5002, host="0.0.0.0")
