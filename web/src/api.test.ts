import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, signIn, signOut, signUp } from './api';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCurrentUser', () => {
  it('returns the signed-in user', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ user: { id: 'user-1', email: 'ana@example.com' } }),
    );

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'ana@example.com',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me');
  });

  it('returns null when the browser has no session', async () => {
    stubFetch(jsonResponse({ user: null }));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the API refuses the session', async () => {
    stubFetch(
      jsonResponse({ message: 'missing_credentials' }, { status: 401 }),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe('signIn', () => {
  it('posts the credentials and returns the user', async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        user: { id: 'user-1', email: 'ana@example.com' },
        mfaRequired: false,
      }),
    );

    await expect(signIn('ana@example.com', 'secret')).resolves.toEqual({
      id: 'user-1',
      email: 'ana@example.com',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ana@example.com',
        password: 'secret',
      }),
    });
  });

  it('throws the API message when the credentials are wrong', async () => {
    stubFetch(
      jsonResponse({ message: 'Invalid email or password' }, { status: 401 }),
    );

    await expect(signIn('ana@example.com', 'wrong')).rejects.toThrow(
      'Invalid email or password',
    );
  });
});

describe('signUp', () => {
  it('posts the credentials and returns the created user', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ id: 'user-1', email: 'ana@example.com' }, { status: 201 }),
    );

    await expect(signUp('ana@example.com', 'secret')).resolves.toEqual({
      id: 'user-1',
      email: 'ana@example.com',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ana@example.com',
        password: 'secret',
      }),
    });
  });

  it('throws the API message when the email is taken', async () => {
    stubFetch(
      jsonResponse({ message: 'Email already registered' }, { status: 409 }),
    );

    await expect(signUp('ana@example.com', 'secret')).rejects.toThrow(
      'Email already registered',
    );
  });
});

describe('signOut', () => {
  it('posts to the sign-out route', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(signOut()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
    });
  });
});
