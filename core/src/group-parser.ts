// A group marker is `@name`, and only at the end of the note: `@home buy
// coffee` is plain text, while `buy coffee @home` names a group. The scan walks
// backwards one marker at a time, so a note salted with `@name` repeats costs a
// single pass instead of the quadratic backtracking a trailing regex pays.
const NAME_CHAR = /[\p{L}\p{N}_-]/u;
const WHITESPACE = /\s/u;

// `\p{L}` reaches outside the BMP, so a backwards step must never split a
// surrogate pair in half and lose the letter it encodes. Masking both units
// isolates their surrogate range, and an index before the string reads NaN,
// which masks to 0 and fails the test. That is why no bounds check is needed.
const SURROGATE_MASK = 0xfc00;
const LEAD_SURROGATE = 0xd800;
const TRAIL_SURROGATE = 0xdc00;

function isSurrogatePair(lead: number, trail: number): boolean {
  return (
    (lead & SURROGATE_MASK) === LEAD_SURROGATE &&
    (trail & SURROGATE_MASK) === TRAIL_SURROGATE
  );
}

function charBefore(text: string, end: number): string {
  return isSurrogatePair(text.charCodeAt(end - 2), text.charCodeAt(end - 1))
    ? text.slice(end - 2, end)
    : text.charAt(end - 1);
}

// Where the run of characters `accepts` matches ends before `end`. The step sits
// in the for update so the cursor always advances; the body only decides where
// the run stops.
function runStart(text: string, end: number, accepts: RegExp): number {
  let start = 0;
  for (let index = end; index > 0; index -= charBefore(text, index).length) {
    if (!accepts.test(charBefore(text, index))) {
      start = index;
      break;
    }
  }
  return start;
}

// True when `start` is the first character of a marker name ending at `end`.
function endsMarker(text: string, start: number, end: number): boolean {
  if (start === end) {
    return false;
  }

  const at = start - 1;
  if (text.charAt(at) !== '@') {
    return false;
  }
  // A marker needs the start of the note or whitespace before its `@`.
  return at === 0 || WHITESPACE.test(text.charAt(at - 1));
}

// Where the body ends once a marker at `start` is removed: after the run of
// whitespace that carried it. The cursor must shrink every step, so a step that
// would not move it back is clamped to `end - 1`.
function bodyEndBefore(text: string, end: number, start: number): number {
  return Math.min(runStart(text, start - 1, WHITESPACE), end - 1);
}

function splitGroups(content: string): { body: string; groupNames: string[] } {
  const trimmed = content.trimEnd();
  const names: string[] = [];
  let end = trimmed.length;

  for (
    let start = runStart(trimmed, end, NAME_CHAR);
    endsMarker(trimmed, start, end);
    end = bodyEndBefore(trimmed, end, start),
      start = runStart(trimmed, end, NAME_CHAR)
  ) {
    names.push(trimmed.slice(start, end));
  }

  return {
    body: trimmed.slice(0, end).trimEnd(),
    // Reversed so the leftmost spelling wins the dedupe, as it always has.
    groupNames: [...new Set(names.reverse().map((name) => name.toLowerCase()))],
  };
}

export function extractGroups(content: string): string[] {
  return splitGroups(content).groupNames;
}

export function stripGroups(content: string): string {
  return splitGroups(content)
    .body.split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}
