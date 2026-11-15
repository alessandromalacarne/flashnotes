import { parseNote } from './parse-note.js';

describe('parseNote', () => {
  it('returns the stripped body and the lowercased, deduplicated groups', () => {
    expect(parseNote('buy coffee @Home @home @work')).toEqual({
      ok: true,
      content: 'buy coffee',
      groupNames: ['home', 'work'],
    });
  });

  it('normalizes a multiline body', () => {
    expect(parseNote('line one  \n  line two @home')).toEqual({
      ok: true,
      content: 'line one\n  line two',
      groupNames: ['home'],
    });
  });

  it('rejects a note without a group', () => {
    expect(parseNote('buy coffee')).toEqual({
      ok: false,
      message: 'Include at least one @group in the note',
    });
    expect(parseNote('@home buy coffee')).toEqual({
      ok: false,
      message: 'Include at least one @group in the note',
    });
  });

  it('rejects a body made only of markers', () => {
    expect(parseNote('@home @work')).toEqual({
      ok: false,
      message: 'The note needs text besides the @group',
    });
  });

  it('accepts exactly 32 groups and rejects 33', () => {
    const accepted = Array.from({ length: 32 }, (_, index) => `@g${index}`);
    expect(parseNote(`body ${accepted.join(' ')}`).ok).toBe(true);

    const rejected = [...accepted, '@g32'];
    expect(parseNote(`body ${rejected.join(' ')}`)).toEqual({
      ok: false,
      message: 'A note can reference at most 32 groups',
    });
  });

  it('accepts a 72-character group name and rejects 73', () => {
    expect(parseNote(`body @${'g'.repeat(72)}`).ok).toBe(true);
    expect(parseNote(`body @${'g'.repeat(73)}`)).toEqual({
      ok: false,
      message: 'Group names can have at most 72 characters',
    });
  });

  it('rejects content above the length limit before parsing markers', () => {
    const raw = `${'a'.repeat(10_000)} @home`;
    expect(parseNote(raw)).toEqual({
      ok: false,
      message: 'content must be shorter than or equal to 10000 characters',
    });
  });

  it('accepts content exactly at the length limit', () => {
    const raw = 'a'.repeat(9_994) + ' @home';
    expect(parseNote(raw).ok).toBe(true);
  });
});
