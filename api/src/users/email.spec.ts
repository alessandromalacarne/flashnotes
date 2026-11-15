import { normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('trims and lowercases the address', () => {
    expect(normalizeEmail('  Ada@Example.COM  ')).toBe('ada@example.com');
  });

  it('normalizes unicode variants to one form', () => {
    expect(normalizeEmail('jos\u00e9@example.com')).toBe(
      'jos\u00e9@example.com',
    );
    expect(normalizeEmail('jose\u0301@example.com')).toBe(
      'jos\u00e9@example.com',
    );
  });

  it('leaves an already normalized address untouched', () => {
    expect(normalizeEmail('ada@example.com')).toBe('ada@example.com');
  });
});
