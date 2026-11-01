import { extractGroups, stripGroups } from './group-parser.js';

describe('extractGroups', () => {
  it('collects names lowercased and deduplicated', () => {
    expect(extractGroups('buy coffee @home @Home @home-work')).toEqual([
      'home',
      'home-work',
    ]);
  });

  it('accepts accents, digits, hyphens and underscores', () => {
    expect(
      extractGroups('remember @café @42 @big-house @welcome_here'),
    ).toEqual(['café', '42', 'big-house', 'welcome_here']);
  });

  it('ignores a marker at the start of the dump', () => {
    expect(extractGroups('@home sweep the floor')).toEqual([]);
  });

  it('ignores a marker in the middle of the dump', () => {
    expect(extractGroups('sweep @home the floor')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractGroups('line one\nline two @home')).toEqual(['home']);
    expect(extractGroups('line one\n@home')).toEqual(['home']);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractGroups('list @home, then @work.')).toEqual([]);
  });

  it('ignores an @ glued to a word', () => {
    expect(extractGroups('mail me at foo@bar.com')).toEqual([]);
  });

  it('ignores a lone @', () => {
    expect(extractGroups('@ and some loose text')).toEqual([]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractGroups('door #home plain text')).toEqual([]);
  });

  it('returns an empty list for text without a marker', () => {
    expect(extractGroups('plain text without any deck')).toEqual([]);
  });
});

describe('stripGroups', () => {
  it('removes a trailing marker and the space that carried it', () => {
    expect(stripGroups('buy coffee @home')).toBe('buy coffee');
  });

  it('removes every trailing marker', () => {
    expect(stripGroups('buy coffee @home @work')).toBe('buy coffee');
    expect(stripGroups('buy coffee\n@home\n@work')).toBe('buy coffee');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripGroups('@home buy coffee')).toBe('@home buy coffee');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripGroups('coffee @home with @work now')).toBe(
      'coffee @home with @work now',
    );
  });

  it('keeps a marker followed by punctuation as part of the body', () => {
    expect(stripGroups('list @home, then @work.')).toBe(
      'list @home, then @work.',
    );
  });

  it('keeps the line structure of a multiline body', () => {
    expect(stripGroups('line one\nline two\nline three @work')).toBe(
      'line one\nline two\nline three',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripGroups(' @home @work ')).toBe('');
  });

  it('leaves #hashtags alone', () => {
    expect(stripGroups('door #home @home')).toBe('door #home');
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

  it('leaves an @ glued to a word alone', () => {
    expect(stripGroups('mail me at foo@bar.com @home')).toBe(
      'mail me at foo@bar.com',
    );
  });
});
