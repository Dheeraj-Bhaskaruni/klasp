"""Voice command parser."""

import re

WORD_NUMBERS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'once': 1, 'twice': 2,
}


def parse_number(text: str | None) -> int:
    if not text:
        return 1
    text = text.strip().lower()
    if text.isdigit():
        return int(text)
    return WORD_NUMBERS.get(text, 1)


def parse_command(text: str, current_line: int, total_lines: int):
    """
    Parse voice command → action dict.
    Commands: next, repeat, repeat N times, go to line N,
              previous, read all, faster, slower, done.
    """
    text = text.strip().lower()

    if any(w in text for w in ['done', 'stop', 'quit', 'exit', 'finish', 'end']):
        return {'action': 'done'}

    if 'faster' in text:
        return {'action': 'faster'}
    if 'slower' in text:
        return {'action': 'slower'}

    if 'read all' in text or 'read everything' in text:
        return {'action': 'read_all'}

    m = re.search(r'(?:repeat|go to|goto|read)\s+line\s+(\d+)(?:\s+(\w+)\s+times?)?', text)
    if m:
        line_num = int(m.group(1))
        times = parse_number(m.group(2)) if m.group(2) else 1
        if 1 <= line_num <= total_lines:
            return {'action': 'goto', 'line': line_num, 'times': times}
        else:
            return {'action': 'error', 'msg': f"Line {line_num} doesn't exist. We have {total_lines} lines."}

    m = re.search(r'(?:repeat\s+(?:it\s+)?)?(\w+)\s+times?', text)
    if m:
        times = parse_number(m.group(1))
        if times and times > 0:
            return {'action': 'repeat', 'times': times}

    if any(w in text for w in ['repeat', 'again', 'one more', 'say again', 'read again']):
        return {'action': 'repeat', 'times': 1}

    if any(w in text for w in ['next', 'continue', 'yes', 'yeah', 'yep', 'got it',
                                'okay', 'ok', 'move on', 'understood', 'learned']):
        return {'action': 'next'}

    if any(w in text for w in ['previous', 'back', 'go back']):
        return {'action': 'previous'}

    return {'action': 'unknown'}
