// A group marker is `@name`, and only at the end of the note: `@casa buy
// coffee` is plain text, while `buy coffee @casa` names a group. `/u` keeps
// accented names together and `\s` lets a marker sit on its own last line.
const TRAILING_MARKERS =
  /(?:^|\s)((?:@[\p{L}\p{N}_-]+(?:\s+@[\p{L}\p{N}_-]+)*))$/u;
const MARKER_NAME = /@([\p{L}\p{N}_-]+)/gu;

function splitGroups(content: string): { body: string; groupNames: string[] } {
  const trimmed = content.trimEnd();
  const match = TRAILING_MARKERS.exec(trimmed);

  if (match === null) {
    return { body: trimmed, groupNames: [] };
  }

  const names = [...match[1].matchAll(MARKER_NAME)].map((name) =>
    name[1].toLowerCase(),
  );

  return {
    body: trimmed.slice(0, match.index).trimEnd(),
    groupNames: [...new Set(names)],
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
