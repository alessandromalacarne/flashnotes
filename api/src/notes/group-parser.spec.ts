import { extractGroups, stripGroups } from './group-parser.js';

describe('extractGroups', () => {
  it('collects names lowercased and deduplicated', () => {
    expect(extractGroups('comprar café @casa @Casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('accepts accents, digits, hyphens and underscores', () => {
    expect(extractGroups('anotar @café @42 @casa-grande @bem_vindo')).toEqual([
      'café',
      '42',
      'casa-grande',
      'bem_vindo',
    ]);
  });

  it('ignores a marker at the start of the dump', () => {
    expect(extractGroups('@casa varrer o chão')).toEqual([]);
  });

  it('ignores a marker in the middle of the dump', () => {
    expect(extractGroups('varrer @casa o chão')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractGroups('linha um\nlinha dois @casa')).toEqual(['casa']);
    expect(extractGroups('linha um\n@casa')).toEqual(['casa']);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractGroups('list @casa, then @trabalho.')).toEqual([]);
  });

  it('ignores an @ glued to a word', () => {
    expect(extractGroups('mail me at foo@bar.com')).toEqual([]);
  });

  it('ignores a lone @', () => {
    expect(extractGroups('@ and some loose text')).toEqual([]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractGroups('porta #casa plain text')).toEqual([]);
  });

  it('returns an empty list for text without a marker', () => {
    expect(extractGroups('plain text without any deck')).toEqual([]);
  });
});

describe('stripGroups', () => {
  it('removes a trailing marker and the space that carried it', () => {
    expect(stripGroups('comprar café @casa')).toBe('comprar café');
  });

  it('removes every trailing marker', () => {
    expect(stripGroups('comprar café @casa @trabalho')).toBe('comprar café');
    expect(stripGroups('comprar café\n@casa\n@trabalho')).toBe('comprar café');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripGroups('@casa comprar café')).toBe('@casa comprar café');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripGroups('café @casa com @trabalho agora')).toBe(
      'café @casa com @trabalho agora',
    );
  });

  it('keeps a marker followed by punctuation as part of the body', () => {
    expect(stripGroups('list @casa, then @trabalho.')).toBe(
      'list @casa, then @trabalho.',
    );
  });

  it('keeps the line structure of a multiline body', () => {
    expect(stripGroups('linha um\nlinha dois\nlinha três @trabalho')).toBe(
      'linha um\nlinha dois\nlinha três',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripGroups(' @casa @trabalho ')).toBe('');
  });

  it('leaves #hashtags alone', () => {
    expect(stripGroups('porta #casa @casa')).toBe('porta #casa');
  });

  it('keeps the indentation of a multiline body', () => {
    expect(stripGroups('primeira linha\n  segunda linha @casa')).toBe(
      'primeira linha\n  segunda linha',
    );
  });

  it('drops the spaces left around the trailing markers', () => {
    expect(stripGroups('café @casa  ')).toBe('café');
    expect(stripGroups('café  \nsegunda @casa')).toBe('café\nsegunda');
  });

  it('leaves an @ glued to a word alone', () => {
    expect(stripGroups('mail me at foo@bar.com @casa')).toBe(
      'mail me at foo@bar.com',
    );
  });
});
