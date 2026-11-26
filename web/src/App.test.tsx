import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getCurrentUser } from './api';
import { createNote, listNotes, listGroups } from './local/store';

vi.mock('./api', () => ({
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('./local/store', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  deleteGroup: vi.fn(),
  listNotes: vi.fn(),
  listGroups: vi.fn(),
  setLocalUser: vi.fn(),
  updateNote: vi.fn(),
}));

const mockedCreateNote = vi.mocked(createNote);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedListNotes = vi.mocked(listNotes);
const mockedListGroups = vi.mocked(listGroups);

const ana = { id: 'user-1', email: 'ana@example.com', isDemo: false };

function renderApp(path = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const homeNote = {
  id: 'note-1',
  content: 'buy coffee',
  createdAt: '2026-10-10T12:00:00.000Z',
  groups: [{ id: 'group-1', name: 'home' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue(ana);
  mockedCreateNote.mockResolvedValue({
    id: 'note-1',
    content: 'buy coffee',
    createdAt: '2026-10-10T12:00:00.000Z',
    groups: [{ id: 'group-1', name: 'home' }],
  });
  mockedListNotes.mockResolvedValue([]);
  mockedListGroups.mockResolvedValue([]);
});

describe('landing page', () => {
  it('presents flashnotes at the root with the signup path', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: /capture thoughts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create an account/i }),
    ).toHaveAttribute('href', '/signup');
  });

  it('shows the working composer before the existing landing content', async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    renderApp('/');

    const composer = await screen.findByRole('textbox', { name: /new note/i });
    const hero = screen.getByRole('heading', { name: /capture thoughts/i });

    expect(
      Boolean(
        composer.compareDocumentPosition(hero) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('lets guest writers reach their local groups from the landing page', async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    renderApp('/');

    expect(
      await screen.findByRole('link', { name: /browse your groups/i }),
    ).toHaveAttribute('href', '/app/groups');
  });
});

describe('anonymous workspace', () => {
  it('lets a guest create notes from the app without signing in', async () => {
    const user = userEvent.setup();
    mockedGetCurrentUser.mockResolvedValue(null);
    renderApp('/app');

    const textarea = await screen.findByRole('textbox', { name: /new note/i });
    await user.type(textarea, 'buy coffee @home{Shift>}{Enter}{/Shift}');

    expect(mockedCreateNote).toHaveBeenCalledWith('buy coffee @home');
    expect(await screen.findByText('note saved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'groups' })).toBeInTheDocument();
  });

  it('lets a guest open a group directly', async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    mockedListNotes.mockResolvedValue([homeNote]);
    renderApp('/app/group/home');

    expect(await screen.findByText('buy coffee')).toBeInTheDocument();
  });
});

describe('composer', () => {
  it('opens with the composer focused', async () => {
    renderApp();

    expect(await screen.findByRole('textbox', { name: /note/i })).toHaveFocus();
  });

  it('sends with Shift+Enter, clears the field and confirms', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'buy coffee @home{Shift>}{Enter}{/Shift}');

    expect(mockedCreateNote).toHaveBeenCalledWith('buy coffee @home');
    expect(textarea).toHaveValue('');
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('Enter only breaks the line', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'line one{Enter}line two @home');

    expect(mockedCreateNote).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one\nline two @home');
  });

  it('disables the send shortcut on touch devices', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, media: '(pointer: coarse)' })),
    );
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two @home');

    expect(mockedCreateNote).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one\nline two @home');
  });

  it('clicking anywhere on the block focuses the field', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });
    textarea.blur();

    await user.click(screen.getByText(/enter sends/i));

    expect(textarea).toHaveFocus();
  });
});

describe('composer errors', () => {
  it('warns when the group is missing and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'text without a group{Shift>}{Enter}{/Shift}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Include at least one @group in the note',
    );
    expect(mockedCreateNote).not.toHaveBeenCalled();
  });

  it('warns when the group is not at the end and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'sweep @home the floor{Shift>}{Enter}{/Shift}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Include at least one @group in the note',
    );
    expect(mockedCreateNote).not.toHaveBeenCalled();
  });

  it('API error keeps the text and shows the message', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockRejectedValue(new Error('Database is down'));
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /note/i });

    await user.type(textarea, 'something @home{Shift>}{Enter}{/Shift}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('something @home');
  });
});

describe('group pages', () => {
  it('opens the groups page straight from the URL', async () => {
    mockedListGroups.mockResolvedValue([
      { id: 'group-1', name: 'home', count: 2 },
    ]);
    renderApp('/app/groups');

    expect(
      await screen.findByRole('listitem', { name: /home/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /note/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a group page straight from the URL', async () => {
    mockedListNotes.mockResolvedValue([homeNote]);
    renderApp('/app/group/home');

    expect(await screen.findByText('buy coffee')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New note' })).toHaveValue('');
  });

  it('opens the notes of a group clicked on the groups page', async () => {
    const user = userEvent.setup();
    mockedListGroups.mockResolvedValue([
      { id: 'group-1', name: 'home', count: 2 },
    ]);
    mockedListNotes.mockResolvedValue([homeNote]);
    renderApp('/app/groups');

    await user.click(await screen.findByRole('link', { name: /@home/ }));

    expect(mockedListNotes).toHaveBeenCalledWith('home');
    expect(await screen.findByText('buy coffee')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('navigates between the composer and the groups page', async () => {
    const user = userEvent.setup();
    mockedListGroups.mockResolvedValue([
      { id: 'group-1', name: 'home', count: 2 },
    ]);
    renderApp();

    const decksLink = await screen.findByRole('link', { name: 'groups' });
    const dumpLink = screen.getByRole('link', { name: 'note' });
    expect(dumpLink.className).toContain('text-ink');
    expect(decksLink.className).toContain('text-ink-faint');

    await user.click(decksLink);

    expect(
      await screen.findByRole('listitem', { name: /home/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'groups' }).className).toContain(
      'text-ink',
    );
    expect(screen.getByRole('link', { name: 'note' }).className).toContain(
      'text-ink-faint',
    );

    await user.click(screen.getByRole('link', { name: 'note' }));

    expect(
      await screen.findByRole('textbox', { name: /note/i }),
    ).toBeInTheDocument();
  });

  it('keeps the groups link highlighted on a group page', async () => {
    mockedListNotes.mockResolvedValue([homeNote]);
    renderApp('/app/group/home');

    await screen.findByText('buy coffee');

    expect(
      screen
        .getByRole('link', { name: 'groups' })
        .classList.contains('text-ink'),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'note' }).classList.contains('text-ink'),
    ).toBe(false);
  });
});
