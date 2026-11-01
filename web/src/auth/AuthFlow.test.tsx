import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  createNote,
  getCurrentUser,
  listGroups,
  listNotes,
  signIn,
  signOut,
  signUp,
} from '../api';

vi.mock('../api', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  deleteGroup: vi.fn(),
  getCurrentUser: vi.fn(),
  listNotes: vi.fn(),
  listGroups: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateNote: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedCreateNote = vi.mocked(createNote);
const mockedListNotes = vi.mocked(listNotes);
const mockedListGroups = vi.mocked(listGroups);
const mockedSignIn = vi.mocked(signIn);
const mockedSignOut = vi.mocked(signOut);
const mockedSignUp = vi.mocked(signUp);

const ana = { id: 'user-1', email: 'ana@example.com' };

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function fillCredentials(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue(null);
  mockedCreateNote.mockResolvedValue({
    id: 'note-1',
    content: 'olá',
    createdAt: '2026-10-14T00:00:00.000Z',
    groups: [],
  });
  mockedListNotes.mockResolvedValue([]);
  mockedListGroups.mockResolvedValue([]);
  mockedSignIn.mockResolvedValue(ana);
  mockedSignUp.mockResolvedValue(ana);
});

describe('auth gate', () => {
  it('sends anonymous visitors from the app to the login page', async () => {
    renderApp('/app');

    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('sends signed-in visitors from the login page to the app', async () => {
    mockedGetCurrentUser.mockResolvedValue(ana);
    renderApp('/login');

    expect(
      await screen.findByRole('textbox', { name: /note/i }),
    ).toBeInTheDocument();
  });
});

describe('signing in', () => {
  it('signs in and lands on the composer', async () => {
    renderApp('/login');
    const user = await fillCredentials(
      'ana@example.com',
      'correct horse battery',
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mockedSignIn).toHaveBeenCalledWith(
      'ana@example.com',
      'correct horse battery',
    );
    expect(
      await screen.findByRole('textbox', { name: /note/i }),
    ).toBeInTheDocument();
  });

  it('returns to the requested page after signing in', async () => {
    renderApp('/app/group/casa');
    const user = await fillCredentials(
      'ana@example.com',
      'correct horse battery',
    );

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: '@casa' }),
    ).toBeInTheDocument();
    expect(mockedListNotes).toHaveBeenCalledWith('casa');
  });

  it('shows the API error and stays on the login page', async () => {
    mockedSignIn.mockRejectedValue(new Error('Invalid email or password'));
    renderApp('/login');
    const user = await fillCredentials('ana@example.com', 'wrong password');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
    expect(
      screen.queryByRole('textbox', { name: /note/i }),
    ).not.toBeInTheDocument();
  });
});

describe('signing up', () => {
  it('requires a password with at least 12 characters', async () => {
    renderApp('/signup');
    const user = await fillCredentials('ana@example.com', 'too short');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use at least 12 characters',
    );
    expect(mockedSignUp).not.toHaveBeenCalled();
  });

  it('creates the account and lands on the composer', async () => {
    renderApp('/signup');
    const user = await fillCredentials(
      'ana@example.com',
      'correct horse battery',
    );

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(mockedSignUp).toHaveBeenCalledWith(
      'ana@example.com',
      'correct horse battery',
    );
    expect(
      await screen.findByRole('textbox', { name: /note/i }),
    ).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('ends the session and returns to the login page', async () => {
    mockedGetCurrentUser.mockResolvedValue(ana);
    renderApp('/app');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'sign out' }));

    expect(mockedSignOut).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
