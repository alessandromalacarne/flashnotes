export interface Deck {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
}

export interface DeckWithCount extends Deck {
  count: number;
}

export interface Dump {
  id: string;
  content: string;
  createdAt: string;
  decks: Deck[];
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message) && message.length > 0) {
      return String(message[0]);
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return `Error ${status}`;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(body, response.status));
  }
  return response;
}

export async function createDump(content: string): Promise<Dump> {
  const response = await request('/api/dumps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Dump;
}

export async function listDumps(deck: string): Promise<Dump[]> {
  const response = await request(`/api/dumps?deck=${encodeURIComponent(deck)}`);
  return (await response.json()) as Dump[];
}

export async function updateDump(id: string, content: string): Promise<Dump> {
  const response = await request(`/api/dumps/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Dump;
}

export async function deleteDump(id: string): Promise<void> {
  await request(`/api/dumps/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listDecks(): Promise<DeckWithCount[]> {
  const response = await request('/api/decks');
  return (await response.json()) as DeckWithCount[];
}

export async function deleteDeck(id: string): Promise<void> {
  await request(`/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { user: User | null };
  return body.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const response = await request('/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as { user: User };
  return body.user;
}

export async function signUp(email: string, password: string): Promise<User> {
  const response = await request('/api/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await response.json()) as User;
}

export async function signOut(): Promise<void> {
  await request('/api/auth/sign-out', { method: 'POST' });
}
