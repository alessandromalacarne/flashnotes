import { describe, expect, it } from 'vitest';
import { extractGroups, stripGroups } from './extract-groups';

describe('extractGroups', () => {
  it('extracts normalized, deduplicated groups', () => {
    expect(extractGroups('buy coffee @Home @home @home-work')).toEqual([
      'home',
      'home-work',
    ]);
  });

  it('ignores a lone @ and an @ glued to a word', () => {
    expect(extractGroups('@ mail me at foo@bar.com')).toEqual([]);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractGroups('log @café @42 @welcome_here')).toEqual([
      'café',
      '42',
      'welcome_here',
    ]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractGroups('#home plain text')).toEqual([]);
  });

  it('ignores a marker at the start of the note', () => {
    expect(extractGroups('@home sweep the floor')).toEqual([]);
  });

  it('ignores a marker in the middle of the note', () => {
    expect(extractGroups('sweep @home the floor')).toEqual([]);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractGroups('list @home, then @work.')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractGroups('line one\nline two @home')).toEqual(['home']);
  });
});

describe('stripGroups', () => {
  it('removes the trailing markers and the space that carried them', () => {
    expect(stripGroups('buy coffee @home')).toBe('buy coffee');
    expect(stripGroups('buy coffee @home @work')).toBe('buy coffee');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripGroups('@home buy coffee')).toBe('@home buy coffee');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripGroups('coffee @home with @work now')).toBe(
      'coffee @home with @work now',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripGroups(' @home @work ')).toBe('');
  });

  it('keeps the indentation of a multiline body', () => {
    expect(stripGroups('first line\n  second line @home')).toBe(
      'first line\n  second line',
    );
  });

  it('drops the spaces left around the trailing markers', () => {
    expect(stripGroups('coffee @home  ')).toBe('coffee');
    expect(stripGroups('coffee  \nsecond @home')).toBe('coffee\nsecond');
  });
});
