"""Code-to-speech conversion — reads every symbol aloud."""

import re
from .symbols import SYMBOL_MAP, SORTED_SYMBOLS


def code_to_speech(line: str) -> str:
    """Convert a code line to spoken words, reading every symbol."""
    if not line.strip():
        return "blank line"

    result = []
    i = 0
    while i < len(line):
        matched = False
        for sym in SORTED_SYMBOLS:
            if line[i:i+len(sym)] == sym:
                result.append(SYMBOL_MAP[sym])
                i += len(sym)
                matched = True
                break

        if not matched:
            char = line[i]
            if char == ' ':
                result.append(' ')
            elif char == '\t':
                result.append(' indent ')
            else:
                result.append(char)
            i += 1

    spoken = ''.join(result)
    spoken = re.sub(r'\s+', ' ', spoken).strip()
    return spoken
