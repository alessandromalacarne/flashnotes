import { describe, expect, it } from 'vitest';
import { extractGroups, stripGroups } from './extract-groups';

describe('extractGroups', () => {
  it('extracts normalized, deduplicated groups', () => {
    expect(extractGroups('comprar café @Casa @casa @casa-trabalho')).toEqual([
      'casa',
      'casa-trabalho',
    ]);
  });

  it('ignores a lone @ and an @ glued to a word', () => {
    expect(extractGroups('@ mail me at foo@bar.com')).toEqual([]);
  });

  it('accepts accents, numbers, hyphens and underscores', () => {
    expect(extractGroups('anotar @café @42 @bem_vindo')).toEqual([
      'café',
      '42',
      'bem_vindo',
    ]);
  });

  it('no longer treats # as a marker', () => {
    expect(extractGroups('#casa plain text')).toEqual([]);
  });

  it('ignores a marker at the start of the note', () => {
    expect(extractGroups('@casa varrer o chão')).toEqual([]);
  });

  it('ignores a marker in the middle of the note', () => {
    expect(extractGroups('varrer @casa o chão')).toEqual([]);
  });

  it('ignores a marker followed by punctuation', () => {
    expect(extractGroups('list @casa, then @trabalho.')).toEqual([]);
  });

  it('finds markers on the last line', () => {
    expect(extractGroups('linha um\nlinha dois @casa')).toEqual(['casa']);
  });
});

describe('stripGroups', () => {
  it('removes the trailing markers and the space that carried them', () => {
    expect(stripGroups('comprar café @casa')).toBe('comprar café');
    expect(stripGroups('comprar café @casa @trabalho')).toBe('comprar café');
  });

  it('keeps a leading marker as part of the body', () => {
    expect(stripGroups('@casa comprar café')).toBe('@casa comprar café');
  });

  it('keeps markers in the middle as part of the body', () => {
    expect(stripGroups('café @casa com @trabalho agora')).toBe(
      'café @casa com @trabalho agora',
    );
  });

  it('collapses to an empty string when only markers were written', () => {
    expect(stripGroups(' @casa @trabalho ')).toBe('');
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
});
