import { extractGroups, stripGroups } from './group-parser.js';
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS_PER_NOTE,
  MAX_NOTE_LENGTH,
} from './note-limits.js';

export type NoteParseResult =
  | { ok: true; content: string; groupNames: string[] }
  | { ok: false; message: string };

// The single source of truth for note validation: the API turns `message` into
// a 400 and the web app shows it in the composer, so the wording is a contract.
export function parseNote(raw: string): NoteParseResult {
  if (raw.length > MAX_NOTE_LENGTH) {
    return failure(
      `content must be shorter than or equal to ${MAX_NOTE_LENGTH} characters`,
    );
  }

  const groupNames = extractGroups(raw);

  if (groupNames.length === 0) {
    return failure('Include at least one @group in the note');
  }

  if (groupNames.length > MAX_GROUPS_PER_NOTE) {
    return failure(
      `A note can reference at most ${MAX_GROUPS_PER_NOTE} groups`,
    );
  }

  if (groupNames.some((name) => name.length > MAX_GROUP_NAME_LENGTH)) {
    return failure(
      `Group names can have at most ${MAX_GROUP_NAME_LENGTH} characters`,
    );
  }

  const content = stripGroups(raw);

  if (content.length === 0) {
    return failure('The note needs text besides the @group');
  }

  return { ok: true, content, groupNames };
}

function failure(message: string): NoteParseResult {
  return { ok: false, message };
}
