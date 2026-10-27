import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDump,
  deleteDump,
  deleteDeck,
  listDumps,
  listDecks,
  updateDump,
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

describe('createDump', () => {
  it('posts the content and returns the created dump', async () => {
    const dump = {
      id: 'dump-1',
      content: 'olá',
      createdAt: '2026-10-14T00:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(dump, { status: 201 }));

    await expect(createDump('olá @casa')).resolves.toEqual(dump);

    expect(fetchMock).toHaveBeenCalledWith('/api/dumps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'olá @casa' }),
    });
  });

  it('rejects with the status when the body carries no message', async () => {
    stubFetch(jsonResponse({ statusCode: 400 }, { status: 400 }));

    await expect(createDump('nope')).rejects.toThrow('Error 400');
  });
});

describe('listDumps', () => {
  it('returns the dumps of the given deck', async () => {
    const dumps = [
      {
        id: 'dump-1',
        content: 'buy coffee',
        createdAt: '2026-10-14T12:00:00.000Z',
        decks: [{ id: 'deck-1', name: 'casa' }],
      },
    ];
    const fetchMock = stubFetch(jsonResponse(dumps));

    await expect(listDumps('casa')).resolves.toEqual(dumps);
    expect(fetchMock).toHaveBeenCalledWith('/api/dumps?deck=casa', undefined);
  });

  it('encodes the deck into the query', async () => {
    const fetchMock = stubFetch(jsonResponse([]));

    await listDumps('café');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps?deck=caf%C3%A9',
      undefined,
    );
  });

  it('throws the API message when the dumps cannot be loaded', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listDumps('casa')).rejects.toThrow('Database is down');
  });
});

describe('listDecks', () => {
  it('returns the decks with their counts', async () => {
    const fetchMock = stubFetch(
      jsonResponse([
        { id: 'deck-1', name: 'casa', count: 2 },
        { id: 'deck-2', name: 'trabalho', count: 1 },
      ]),
    );

    await expect(listDecks()).resolves.toEqual([
      { id: 'deck-1', name: 'casa', count: 2 },
      { id: 'deck-2', name: 'trabalho', count: 1 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/decks', undefined);
  });

  it('throws the API message when the request fails', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listDecks()).rejects.toThrow('Database is down');
  });
});

describe('listDecks error bodies', () => {
  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['name must be longer', 'name is required'] },
        { status: 422 },
      ),
    );

    await expect(listDecks()).rejects.toThrow('name must be longer');
  });

  it('falls back to the status for an empty message list', async () => {
    stubFetch(jsonResponse({ message: [] }, { status: 422 }));

    await expect(listDecks()).rejects.toThrow('Error 422');
  });

  it('falls back to the status for a message that is not a string', async () => {
    stubFetch(jsonResponse({ message: 42 }, { status: 500 }));

    await expect(listDecks()).rejects.toThrow('Error 500');
  });

  it('falls back to the status for a body without a message', async () => {
    stubFetch(jsonResponse({ error: 'nope' }, { status: 404 }));

    await expect(listDecks()).rejects.toThrow('Error 404');
  });

  it('falls back to the status for a body that is not an object', async () => {
    stubFetch(jsonResponse('gateway timeout', { status: 504 }));

    await expect(listDecks()).rejects.toThrow('Error 504');
  });

  it('falls back to the status when the body is not json', async () => {
    stubFetch(
      new Response('<html>oops</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(listDecks()).rejects.toThrow('Error 502');
  });
});

describe('deleteDeck', () => {
  it('sends a DELETE for the deck id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteDeck('deck-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/decks/deck-1', {
      method: 'DELETE',
    });
  });

  it('encodes the deck id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteDeck('deck/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/decks/deck%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the deck is gone', async () => {
    stubFetch(jsonResponse({ message: 'Deck not found' }, { status: 404 }));

    await expect(deleteDeck('deck-1')).rejects.toThrow('Deck not found');
  });
});

describe('updateDump', () => {
  it('patches the content and returns the updated dump', async () => {
    const dump = {
      id: 'dump-1',
      content: 'buy tea',
      createdAt: '2026-10-14T00:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(dump));

    await expect(updateDump('dump-1', 'buy tea @casa')).resolves.toEqual(dump);

    expect(fetchMock).toHaveBeenCalledWith('/api/dumps/dump-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'buy tea @casa' }),
    });
  });

  it('encodes the dump id into the path', async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        id: 'dump/with space',
        content: 'buy coffee',
        createdAt: '2026-10-14T00:00:00.000Z',
        decks: [{ id: 'deck-1', name: 'casa' }],
      }),
    );

    await updateDump('dump/with space', 'buy coffee @casa');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps/dump%2Fwith%20space',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('throws the API message when the dump is gone', async () => {
    stubFetch(jsonResponse({ message: 'Dump not found' }, { status: 404 }));

    await expect(updateDump('dump-1', 'buy tea @casa')).rejects.toThrow(
      'Dump not found',
    );
  });

  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['content should not be empty'] },
        { status: 400 },
      ),
    );

    await expect(updateDump('dump-1', '')).rejects.toThrow(
      'content should not be empty',
    );
  });
});

describe('deleteDump', () => {
  it('sends a DELETE for the dump id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteDump('dump-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/dumps/dump-1', {
      method: 'DELETE',
    });
  });

  it('encodes the dump id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteDump('dump/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps/dump%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the dump is gone', async () => {
    stubFetch(jsonResponse({ message: 'Dump not found' }, { status: 404 }));

    await expect(deleteDump('dump-1')).rejects.toThrow('Dump not found');
  });
});
