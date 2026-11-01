export interface Group {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
}

export interface GroupWithCount extends Group {
  count: number;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  groups: Group[];
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

export async function createNote(content: string): Promise<Note> {
  const response = await request('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Note;
}

export async function listNotes(group: string): Promise<Note[]> {
  const response = await request(
    `/api/notes?group=${encodeURIComponent(group)}`,
  );
  return (await response.json()) as Note[];
}

export async function updateNote(id: string, content: string): Promise<Note> {
  const response = await request(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Note;
}

export async function deleteNote(id: string): Promise<void> {
  await request(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listGroups(): Promise<GroupWithCount[]> {
  const response = await request('/api/groups');
  return (await response.json()) as GroupWithCount[];
}

export async function deleteGroup(id: string): Promise<void> {
  await request(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
