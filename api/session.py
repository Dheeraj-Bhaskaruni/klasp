"""Teaching session API — start, command, speak-line, end."""

from flask import Blueprint, request, jsonify
import platform
import subprocess
from core.speech import code_to_speech
from core.parser import parse_command

bp = Blueprint('session', __name__, url_prefix='/api')

# ── Session state ─────────────────────────────────────────────────────────

state = {
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
    if state["tts_mode"] == "server" and platform.system() == "Darwin":
        subprocess.run(["say", "-v", "Samantha", "-r", str(state["rate"]), text])
    else:
        speak_queue.append(text)


def speak_line(idx: int):
    total = len(state["lines"])
    spoken = code_to_speech(state["lines"][idx])
    speak(f"Line {idx + 1} of {total}: {spoken}")


def get_state():
    # Auto-save progress
    from api.lessons import auto_save_progress
    auto_save_progress(state)

    return {
        "lines": [
            {
                "number": i + 1,
                "code": line,
                "spoken": code_to_speech(line),
                "learned": i in state["learned"],
                "current": i == state["current"],
            }
            for i, line in enumerate(state["lines"])
        ],
        "current": state["current"] + 1,
        "total": len(state["lines"]),
        "learned_count": len(state["learned"]),
        "rate": state["rate"],
        "active": state["active"],
        "tts_mode": state["tts_mode"],
    }


def make_response(extra=None):
    s = get_state()
    if extra:
        s.update(extra)
    s["speak_queue"] = list(speak_queue)
    speak_queue.clear()
    return s


# ── Routes ────────────────────────────────────────────────────────────────

@bp.route('/start', methods=['POST'])
def start():
    data = request.json
    code = data.get("code", "")
    lines = [l for l in code.split("\n") if l.strip()]

    if not lines:
        return jsonify({"error": "No code provided"}), 400

    state["lines"] = lines
    state["current"] = 0
    state["learned"] = set()
    state["rate"] = 160
    state["active"] = True
    state["lesson_id"] = data.get("lesson_id")
    state["group"] = data.get("group")
    state["tts_mode"] = data.get("tts_mode", "browser")
    speak_queue.clear()

    speak(f"I have {len(lines)} lines to teach you. Let's begin!")
    speak_line(0)

    return jsonify(make_response({"message": "Session started. Say next, repeat, or done."}))


@bp.route('/command', methods=['POST'])
def command():
    data = request.json
    cmd_text = data.get("command", "").lower().strip()

    if not state["active"] or not state["lines"]:
        return jsonify({"error": "No active session"}), 400

    speak_queue.clear()
    total = len(state["lines"])
    current = state["current"]
    cmd = parse_command(cmd_text, current + 1, total)
    action = cmd["action"]
    message = ""

    if action == "next":
        state["learned"].add(current)
        state["current"] += 1
        if state["current"] < total:
            speak_line(state["current"])
            message = "Next line."
        else:
            speak(f"All {total} lines done! You learned {len(state['learned'])} lines. Great job!")
            message = f"All done! Learned {len(state['learned'])}/{total} lines."
            state["active"] = False

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
        state["current"] = target
        for i in range(times):
            if times > 1:
                speak(f"Time {i + 1}.")
            speak_line(target)
        message = f"Line {cmd['line']}."

    elif action == "previous":
        if current > 0:
            state["current"] -= 1
            speak_line(state["current"])
            message = "Previous line."
        else:
            speak("Already at the first line.")
            message = "Already at line 1."

    elif action == "read_all":
        speak("Reading all remaining lines.")
        for i in range(state["current"], total):
            speak_line(i)
        state["current"] = total
        state["active"] = False
        message = "Read all lines."

    elif action == "faster":
        state["rate"] = min(state["rate"] + 30, 300)
        speak("Faster.")
        message = f"Speed: {state['rate']}"

    elif action == "slower":
        state["rate"] = max(state["rate"] - 30, 100)
        speak("Slower.")
        message = f"Speed: {state['rate']}"

    elif action == "done":
        learned_count = len(state["learned"])
        speak(f"Session ended. You learned {learned_count} out of {total} lines.")
        state["active"] = False
        message = f"Done! Learned {learned_count}/{total}."

    elif action == "error":
        speak(cmd["msg"])
        message = cmd["msg"]

    else:
        speak("Say next, repeat, repeat 3 times, go to line 5, or done.")
        message = "Didn't catch that."

    return jsonify(make_response({"message": message}))


@bp.route('/speak-line', methods=['POST'])
def speak_line_route():
    data = request.json
    line_num = data.get("line", state["current"] + 1)
    times = data.get("times", 1)

    if not state["lines"]:
        return jsonify({"error": "No session"}), 400

    idx = line_num - 1
    if idx < 0 or idx >= len(state["lines"]):
        return jsonify({"error": "Invalid line number"}), 400

    speak_queue.clear()
    state["current"] = idx
    for i in range(times):
        if times > 1:
            speak(f"Time {i + 1}.")
        speak_line(idx)

    return jsonify(make_response())


@bp.route('/end', methods=['POST'])
def end():
    learned = len(state["learned"])
    total = len(state["lines"])
    state["active"] = False
    speak_queue.clear()
    speak(f"Session ended. You learned {learned} out of {total} lines.")
    return jsonify(make_response())


@bp.route('/tts-mode', methods=['POST'])
def tts_mode():
    mode = request.json.get("mode", "browser")
    if mode not in ("browser", "server"):
        return jsonify({"error": "Invalid mode"}), 400
    state["tts_mode"] = mode
    return jsonify({"tts_mode": mode})
