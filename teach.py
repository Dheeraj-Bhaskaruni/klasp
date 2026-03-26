"""
Klasp - Reads content line by line like a human teacher.
Reads every symbol aloud: dots, underscores, brackets, etc.
Voice commands: next, repeat, repeat line N, repeat N times, done.

Uses:
  - macOS 'say' command for TTS (offline, instant)
  - SpeechRecognition + Google STT for voice commands (free)
"""

import speech_recognition as sr
import subprocess
import re
import sys
import time

# ── Symbol to spoken word mapping ─────────────────────────────────────────

SYMBOL_MAP = {
    '.': ' dot ',
    ',': ' comma ',
    ':': ' colon ',
    ';': ' semicolon ',
    '(': ' open paren ',
    ')': ' close paren ',
    '[': ' open bracket ',
    ']': ' close bracket ',
    '{': ' open brace ',
    '}': ' close brace ',
    '<': ' less than ',
    '>': ' greater than ',
    '=': ' equals ',
    '==': ' double equals ',
    '!=': ' not equals ',
    '===': ' triple equals ',
    '!==': ' not triple equals ',
    '+=': ' plus equals ',
    '-=': ' minus equals ',
    '*=': ' star equals ',
    '/=': ' slash equals ',
    '=>': ' arrow ',
    '->': ' arrow ',
    '<=': ' less than or equal ',
    '>=': ' greater than or equal ',
    '+': ' plus ',
    '-': ' hyphen ',
    '*': ' star ',
    '/': ' slash ',
    '\\': ' backslash ',
    '|': ' pipe ',
    '||': ' double pipe ',
    '&&': ' double ampersand ',
    '&': ' ampersand ',
    '!': ' exclamation ',
    '?': ' question mark ',
    '@': ' at ',
    '#': ' hash ',
    '$': ' dollar ',
    '%': ' percent ',
    '^': ' caret ',
    '~': ' tilde ',
    '_': ' underscore ',
    '`': ' backtick ',
    '"': ' quote ',
    "'": ' single quote ',
    '...': ' dot dot dot ',
    '//': ' double slash ',
    '/*': ' slash star ',
    '*/': ' star slash ',
}

# Sort by length (longest first) so multi-char symbols match before single-char
SORTED_SYMBOLS = sorted(SYMBOL_MAP.keys(), key=len, reverse=True)


def code_to_speech(line: str) -> str:
    """Convert a code line to spoken words, reading every symbol."""
    if not line.strip():
        return "blank line"

    result = []
    i = 0
    while i < len(line):
        matched = False
        # Try multi-char symbols first
        for sym in SORTED_SYMBOLS:
            if line[i:i+len(sym)] == sym:
                result.append(SYMBOL_MAP[sym])
                i += len(sym)
                matched = True
                break

        if not matched:
            char = line[i]
            if char == ' ':
                # Collapse spaces, don't read each one
                result.append(' ')
            elif char == '\t':
                result.append(' indent ')
            else:
                result.append(char)
            i += 1

    spoken = ''.join(result)
    # Clean up extra spaces
    spoken = re.sub(r'\s+', ' ', spoken).strip()
    return spoken


# ── TTS using macOS 'say' ─────────────────────────────────────────────────

def speak(text: str, rate: int = 160):
    """Speak text using macOS 'say' command."""
    print(f"  >> {text}")
    subprocess.run(["say", "-v", "Samantha", "-r", str(rate), text])


def speak_line(line_num: int, line: str, total: int, rate: int = 160):
    """Speak a code line with its line number."""
    spoken = code_to_speech(line)
    speak(f"Line {line_num} of {total}: {spoken}", rate)


# ── STT Setup ─────────────────────────────────────────────────────────────

def create_recognizer():
    recognizer = sr.Recognizer()
    recognizer.energy_threshold = 300
    recognizer.dynamic_energy_threshold = True
    recognizer.pause_threshold = 1.2
    return recognizer


def listen(recognizer, mic) -> str | None:
    """Listen for a voice command."""
    try:
        print("\n  Listening... (say: next / repeat / repeat 3 times / go to line 5 / done)")
        with mic as source:
            audio = recognizer.listen(source, timeout=10, phrase_time_limit=10)

        text = recognizer.recognize_google(audio, language="en-US")
        print(f"  You: {text}")
        return text.lower().strip()

    except sr.WaitTimeoutError:
        print("  (No speech detected, say a command...)")
        return None
    except sr.UnknownValueError:
        print("  (Didn't catch that, try again...)")
        return None
    except sr.RequestError as e:
        print(f"  (Recognition error: {e})")
        return None


# ── Parse voice commands ──────────────────────────────────────────────────

def parse_command(text: str, current_line: int, total_lines: int):
    """
    Parse voice command and return action dict.
    Commands:
      - next / continue           → move to next line
      - repeat / again            → repeat current line
      - repeat 3 times            → repeat current line N times
      - repeat line 5             → go to line 5 and read it
      - repeat line 5 three times → go to line 5 and read it N times
      - go to line 5              → jump to line 5
      - previous / back           → go to previous line
      - read all / read everything → read all remaining lines
      - done / stop / quit        → end session
      - faster / slower           → adjust speed
    """
    text = text.strip()

    # Done
    if any(w in text for w in ['done', 'stop', 'quit', 'exit', 'finish', 'end']):
        return {'action': 'done'}

    # Faster / Slower
    if 'faster' in text:
        return {'action': 'faster'}
    if 'slower' in text:
        return {'action': 'slower'}

    # "read all" / "read everything"
    if 'read all' in text or 'read everything' in text:
        return {'action': 'read_all'}

    # "repeat line N [M times]"
    m = re.search(r'(?:repeat|go to|goto|read)\s+line\s+(\d+)(?:\s+(\w+)\s+times?)?', text)
    if m:
        line_num = int(m.group(1))
        times = parse_number(m.group(2)) if m.group(2) else 1
        if 1 <= line_num <= total_lines:
            return {'action': 'goto', 'line': line_num, 'times': times}
        else:
            return {'action': 'error', 'msg': f"Line {line_num} doesn't exist. We have {total_lines} lines."}

    # "repeat N times" / "N times" / "repeat it N times"
    m = re.search(r'(?:repeat\s+(?:it\s+)?)?(\w+)\s+times?', text)
    if m:
        times = parse_number(m.group(1))
        if times and times > 0:
            return {'action': 'repeat', 'times': times}

    # "repeat" / "again" / "one more time"
    if any(w in text for w in ['repeat', 'again', 'one more', 'say again', 'read again']):
        return {'action': 'repeat', 'times': 1}

    # "next" / "continue" / "yes" / "got it"
    if any(w in text for w in ['next', 'continue', 'yes', 'yeah', 'yep', 'got it',
                                'okay', 'ok', 'move on', 'understood', 'learned']):
        return {'action': 'next'}

    # "previous" / "back"
    if any(w in text for w in ['previous', 'back', 'go back']):
        return {'action': 'previous'}

    # Default: didn't understand
    return {'action': 'unknown'}


WORD_NUMBERS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'once': 1, 'twice': 2,
}


def parse_number(text: str | None) -> int:
    """Parse a number from text (digit or word)."""
    if not text:
        return 1
    text = text.strip().lower()
    if text.isdigit():
        return int(text)
    return WORD_NUMBERS.get(text, 1)


# ── Main ──────────────────────────────────────────────────────────────────

def get_notes() -> list[str]:
    """Get notes from user via multiline input."""
    print("\n  Paste your code/notes below.")
    print("  When done, type END on a new line and press Enter.\n")

    lines = []
    while True:
        try:
            line = input()
            if line.strip().upper() == 'END':
                break
            lines.append(line)
        except EOFError:
            break

    # Remove trailing empty lines
    while lines and not lines[-1].strip():
        lines.pop()

    return lines


def main():
    print("=" * 55)
    print("  VOICE CODE TEACHER")
    print("  Reads your code line by line like a teacher")
    print("  Every symbol is spoken: dots, brackets, etc.")
    print("=" * 55)

    # Get notes
    lines = get_notes()

    if not lines:
        print("\n  No notes provided. Exiting.")
        return

    total = len(lines)
    print(f"\n  Got {total} lines. Setting up voice recognition...\n")

    # Set up STT
    recognizer = create_recognizer()
    mic = sr.Microphone()

    print("  Calibrating for ambient noise... (stay quiet for 2 seconds)")
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=2)
    print("  Ready!\n")

    speak(f"I have {total} lines to teach you. Let's begin!")
    time.sleep(0.3)

    current = 0  # 0-indexed
    rate = 160    # speech rate (words per minute)
    learned = set()

    while current < total:
        # Read current line
        speak_line(current + 1, lines[current], total, rate)

        # Wait for command
        while True:
            cmd_text = listen(recognizer, mic)
            if cmd_text is None:
                continue

            cmd = parse_command(cmd_text, current + 1, total)
            action = cmd['action']

            if action == 'next':
                learned.add(current)
                current += 1
                if current < total:
                    speak("Next line.", rate)
                break

            elif action == 'repeat':
                times = cmd.get('times', 1)
                speak(f"Repeating {times} time{'s' if times > 1 else ''}.", rate)
                for i in range(times):
                    if times > 1:
                        speak(f"Time {i + 1}.", rate)
                    speak_line(current + 1, lines[current], total, rate)
                # Stay on same line, wait for next command

            elif action == 'goto':
                target = cmd['line'] - 1  # convert to 0-indexed
                times = cmd.get('times', 1)
                current = target
                speak(f"Going to line {cmd['line']}.", rate)
                for i in range(times):
                    if times > 1:
                        speak(f"Time {i + 1}.", rate)
                    speak_line(current + 1, lines[current], total, rate)
                # Stay on that line

            elif action == 'previous':
                if current > 0:
                    current -= 1
                    speak("Going back.", rate)
                    break  # will read the line at top of loop
                else:
                    speak("Already at the first line.", rate)

            elif action == 'read_all':
                speak("Reading all remaining lines.", rate)
                for i in range(current, total):
                    speak_line(i + 1, lines[i], total, rate)
                    time.sleep(0.3)
                current = total  # end
                break

            elif action == 'faster':
                rate = min(rate + 30, 300)
                speak(f"Speed increased to {rate}.", rate)

            elif action == 'slower':
                rate = max(rate - 30, 100)
                speak(f"Speed decreased to {rate}.", rate)

            elif action == 'error':
                speak(cmd['msg'], rate)

            elif action == 'done':
                speak(f"Session ended. You learned {len(learned)} out of {total} lines.", rate)
                print(f"\n  Lines learned: {sorted(l + 1 for l in learned)}")
                print(f"  Lines remaining: {sorted(i + 1 for i in range(total) if i not in learned)}")
                sys.exit(0)

            else:
                speak("I didn't get that. Say next, repeat, repeat 3 times, go to line 5, or done.", rate)

    # All lines complete
    speak(f"All {total} lines done! You learned {len(learned)} lines. Great job!", rate)
    print(f"\n  Session complete! {len(learned)}/{total} lines learned.")


if __name__ == "__main__":
    main()
