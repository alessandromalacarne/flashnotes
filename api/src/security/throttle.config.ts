const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Read once at startup. Tests and deployments tune these per environment; the
// defaults keep a single client from hammering the API.
export const THROTTLE_TTL_MS = positiveInt(process.env.THROTTLE_TTL_MS, 60_000);
export const THROTTLE_LIMIT = positiveInt(process.env.THROTTLE_LIMIT, 120);

// Sign-in and sign-up are the expensive routes (one scrypt derivation per
// request), so they get a much tighter bucket than the rest of the API.
export const AUTH_THROTTLE_TTL_MS = positiveInt(
  process.env.AUTH_THROTTLE_TTL_MS,
  60_000,
);
export const AUTH_THROTTLE_LIMIT = positiveInt(
  process.env.AUTH_THROTTLE_LIMIT,
  5,
);
