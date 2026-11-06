export const normalizeEmail = (email: string): string =>
  email.trim().normalize('NFC').toLowerCase();
