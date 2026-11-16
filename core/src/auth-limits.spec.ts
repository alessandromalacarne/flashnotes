import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './auth-limits.js';

describe('auth limits', () => {
  it('pins the contract both the API and the web form enforce', () => {
    expect(MAX_EMAIL_LENGTH).toBe(254);
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
  });
});
