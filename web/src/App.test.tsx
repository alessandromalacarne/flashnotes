import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createDump, getCurrentUser, listDumps, listDecks } from './api';

vi.mock('./api', () => ({
  createDump: vi.fn(),
  deleteDump: vi.fn(),
  deleteDeck: vi.fn(),
  getCurrentUser: vi.fn(),
  listDumps: vi.fn(),
  listDecks: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateDump: vi.fn(),
}));

const mockedCreateDump = vi.mocked(createDump);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedListDumps = vi.mocked(listDumps);
const mockedListDecks = vi.mocked(listDecks);

const ana = { id: 'user-1', email: 'ana@example.com' };

function renderApp(path = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const casaDump = {
  id: 'dump-1',
  content: 'buy coffee',
  createdAt: '2026-10-10T12:00:00.000Z',
  decks: [{ id: 'deck-1', name: 'casa' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue(ana);
  mockedCreateDump.mockResolvedValue({
    id: 'dump-1',
    content: 'buy coffee',
    createdAt: '2026-10-10T12:00:00.000Z',
    decks: [{ id: 'deck-1', name: 'casa' }],
  });
  mockedListDumps.mockResolvedValue([]);
  mockedListDecks.mockResolvedValue([]);
});

describe('landing page', () => {
  it('presents quickdump at the root with the signup path', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: /capture thoughts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /start dumping/i }),
    ).toHaveAttribute('href', '/signup');
  });
});

describe('composer', () => {
  it('opens with the composer focused', async () => {
    renderApp();

    expect(await screen.findByRole('textbox', { name: /dump/i })).toHaveFocus();
  });

  it('sends with Enter, clears the field and confirms', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'buy coffee @casa{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('buy coffee @casa');
    expect(textarea).toHaveValue('');
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('Shift+Enter breaks the line instead of sending', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'line one{Shift>}{Enter}{/Shift}line two @casa');

    expect(mockedCreateDump).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one\nline two @casa');
  });

  it('clicking anywhere on the block focuses the field', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });
    textarea.blur();

    await user.click(screen.getByText(/enter sends/i));

    expect(textarea).toHaveFocus();
  });
});

describe('composer errors', () => {
  it('warns when the deck is missing and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'text without a deck{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Include at least one @deck in the dump',
    );
    expect(mockedCreateDump).not.toHaveBeenCalled();
  });

  it('warns when the deck is not at the end and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'varrer @casa o chão{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Include at least one @deck in the dump',
    );
    expect(mockedCreateDump).not.toHaveBeenCalled();
  });

  it('API error keeps the text and shows the message', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockRejectedValue(new Error('Database is down'));
    renderApp();
    const textarea = await screen.findByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'algo @casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('algo @casa');
  });
});

describe('deck pages', () => {
  it('opens the decks page straight from the URL', async () => {
    mockedListDecks.mockResolvedValue([
      { id: 'deck-1', name: 'casa', count: 2 },
    ]);
    renderApp('/app/decks');

    expect(
      await screen.findByRole('listitem', { name: /casa/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /dump/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a deck page straight from the URL', async () => {
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/app/deck/casa');

    expect(await screen.findByText('buy coffee')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New dump' })).toHaveValue('');
  });

  it('opens the dumps of a deck clicked on the decks page', async () => {
    const user = userEvent.setup();
    mockedListDecks.mockResolvedValue([
      { id: 'deck-1', name: 'casa', count: 2 },
    ]);
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/app/decks');

    await user.click(await screen.findByRole('link', { name: /@casa/ }));

    expect(mockedListDumps).toHaveBeenCalledWith('casa');
    expect(await screen.findByText('buy coffee')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('navigates between the composer and the decks page', async () => {
    const user = userEvent.setup();
    mockedListDecks.mockResolvedValue([
      { id: 'deck-1', name: 'casa', count: 2 },
    ]);
    renderApp();

    const decksLink = await screen.findByRole('link', { name: 'decks' });
    const dumpLink = screen.getByRole('link', { name: 'dump' });
    expect(dumpLink.className).toContain('text-ink');
    expect(decksLink.className).toContain('text-ink-faint');

    await user.click(decksLink);

    expect(
      await screen.findByRole('listitem', { name: /casa/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'decks' }).className).toContain(
      'text-ink',
    );
    expect(screen.getByRole('link', { name: 'dump' }).className).toContain(
      'text-ink-faint',
    );

    await user.click(screen.getByRole('link', { name: 'dump' }));

    expect(
      await screen.findByRole('textbox', { name: /dump/i }),
    ).toBeInTheDocument();
  });

  it('keeps the decks link highlighted on a deck page', async () => {
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/app/deck/casa');

    await screen.findByText('buy coffee');

    expect(
      screen
        .getByRole('link', { name: 'decks' })
        .classList.contains('text-ink'),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'dump' }).classList.contains('text-ink'),
    ).toBe(false);
  });
});
