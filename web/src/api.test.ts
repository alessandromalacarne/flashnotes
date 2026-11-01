import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNote,
  deleteNote,
  deleteGroup,
  getCurrentUser,
  listNotes,
  listGroups,
  signIn,
  signOut,
  signUp,
  updateNote,
} from './api';

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

describe('createNote', () => {
  it('posts the content and returns the created note', async () => {
    const note = {
      id: 'note-1',
      content: 'olá',
      createdAt: '2026-10-14T00:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(note, { status: 201 }));

    await expect(createNote('olá @casa')).resolves.toEqual(note);

    expect(fetchMock).toHaveBeenCalledWith('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'olá @casa' }),
    });
  });

  it('rejects with the status when the body carries no message', async () => {
    stubFetch(jsonResponse({ statusCode: 400 }, { status: 400 }));

    await expect(createNote('nope')).rejects.toThrow('Error 400');
  });
});

describe('listNotes', () => {
  it('returns the notes of the given group', async () => {
    const notes = [
      {
        id: 'note-1',
        content: 'buy coffee',
        createdAt: '2026-10-14T12:00:00.000Z',
        groups: [{ id: 'group-1', name: 'casa' }],
      },
    ];
    const fetchMock = stubFetch(jsonResponse(notes));

    await expect(listNotes('casa')).resolves.toEqual(notes);
    expect(fetchMock).toHaveBeenCalledWith('/api/notes?group=casa', undefined);
  });

  it('encodes the group into the query', async () => {
    const fetchMock = stubFetch(jsonResponse([]));

    await listNotes('café');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes?group=caf%C3%A9',
      undefined,
    );
  });

  it('throws the API message when the notes cannot be loaded', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listNotes('casa')).rejects.toThrow('Database is down');
  });
});

describe('listGroups', () => {
  it('returns the groups with their counts', async () => {
    const fetchMock = stubFetch(
      jsonResponse([
        { id: 'group-1', name: 'casa', count: 2 },
        { id: 'group-2', name: 'trabalho', count: 1 },
      ]),
    );

    await expect(listGroups()).resolves.toEqual([
      { id: 'group-1', name: 'casa', count: 2 },
      { id: 'group-2', name: 'trabalho', count: 1 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/groups', undefined);
  });

  it('throws the API message when the request fails', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listGroups()).rejects.toThrow('Database is down');
  });
});

describe('listGroups error bodies', () => {
  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['name must be longer', 'name is required'] },
        { status: 422 },
      ),
    );

    await expect(listGroups()).rejects.toThrow('name must be longer');
  });

  it('falls back to the status for an empty message list', async () => {
    stubFetch(jsonResponse({ message: [] }, { status: 422 }));

    await expect(listGroups()).rejects.toThrow('Error 422');
  });

  it('falls back to the status for a message that is not a string', async () => {
    stubFetch(jsonResponse({ message: 42 }, { status: 500 }));

    await expect(listGroups()).rejects.toThrow('Error 500');
  });

  it('falls back to the status for a body without a message', async () => {
    stubFetch(jsonResponse({ error: 'nope' }, { status: 404 }));

    await expect(listGroups()).rejects.toThrow('Error 404');
  });

  it('falls back to the status for a body that is not an object', async () => {
    stubFetch(jsonResponse('gateway timeout', { status: 504 }));

    await expect(listGroups()).rejects.toThrow('Error 504');
  });

  it('falls back to the status when the body is not json', async () => {
    stubFetch(
      new Response('<html>oops</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(listGroups()).rejects.toThrow('Error 502');
  });
});

describe('deleteGroup', () => {
  it('sends a DELETE for the group id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteGroup('group-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/groups/group-1', {
      method: 'DELETE',
    });
  });

  it('encodes the group id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteGroup('group/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/groups/group%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the group is gone', async () => {
    stubFetch(jsonResponse({ message: 'Group not found' }, { status: 404 }));

    await expect(deleteGroup('group-1')).rejects.toThrow('Group not found');
  });
});

describe('updateNote', () => {
  it('patches the content and returns the updated note', async () => {
    const note = {
      id: 'note-1',
      content: 'buy tea',
      createdAt: '2026-10-14T00:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(note));

    await expect(updateNote('note-1', 'buy tea @casa')).resolves.toEqual(note);

    expect(fetchMock).toHaveBeenCalledWith('/api/notes/note-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'buy tea @casa' }),
    });
  });

  it('encodes the note id into the path', async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        id: 'note/with space',
        content: 'buy coffee',
        createdAt: '2026-10-14T00:00:00.000Z',
        groups: [{ id: 'group-1', name: 'casa' }],
      }),
    );

    await updateNote('note/with space', 'buy coffee @casa');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes/note%2Fwith%20space',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('throws the API message when the note is gone', async () => {
    stubFetch(jsonResponse({ message: 'Note not found' }, { status: 404 }));

    await expect(updateNote('note-1', 'buy tea @casa')).rejects.toThrow(
      'Note not found',
    );
  });

  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['content should not be empty'] },
        { status: 400 },
      ),
    );

    await expect(updateNote('note-1', '')).rejects.toThrow(
      'content should not be empty',
    );
  });
});

describe('deleteNote', () => {
  it('sends a DELETE for the note id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteNote('note-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/notes/note-1', {
      method: 'DELETE',
    });
  });

  it('encodes the note id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteNote('note/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes/note%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the note is gone', async () => {
    stubFetch(jsonResponse({ message: 'Note not found' }, { status: 404 }));

    await expect(deleteNote('note-1')).rejects.toThrow('Note not found');
  });
});
