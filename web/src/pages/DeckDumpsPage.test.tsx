import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDump, deleteDump, listDumps, updateDump } from '../api';
import { DeckDumpsPage } from './DeckDumpsPage';

vi.mock('../api', () => ({
  createDump: vi.fn(),
  deleteDump: vi.fn(),
  listDumps: vi.fn(),
  updateDump: vi.fn(),
}));

const mockedCreateDump = vi.mocked(createDump);
const mockedDeleteDump = vi.mocked(deleteDump);
const mockedListDumps = vi.mocked(listDumps);
const mockedUpdateDump = vi.mocked(updateDump);

const dumps = [
  {
    id: 'dump-1',
    content: 'buy coffee',
    createdAt: '2026-10-14T12:00:00.000Z',
    decks: [{ id: 'deck-1', name: 'casa' }],
  },
  {
    id: 'dump-2',
    content: 'fix the sink',
    createdAt: '2026-10-13T09:30:00.000Z',
    decks: [
      { id: 'deck-1', name: 'casa' },
      { id: 'deck-2', name: 'home' },
    ],
  },
];

function renderPage(path = '/deck/casa') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/deck/:deck" element={<DeckDumpsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findCards() {
  return screen.findAllByRole('listitem');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListDumps.mockResolvedValue(dumps);
  mockedDeleteDump.mockResolvedValue(undefined);
});

describe('DeckDumpsPage', () => {
  it('shows the dumps of the deck from the URL', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy coffee')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('fix the sink')).toBeInTheDocument();
  });

  it('heads the page with the deck and how many dumps it holds', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: '@casa' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('uses the singular for a single dump', async () => {
    mockedListDumps.mockResolvedValue([dumps[0]!]);
    renderPage();

    expect(await screen.findByText('1 dump')).toBeInTheDocument();
  });

  it('shows the decks and the date of each dump', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(within(cards[1]!).getByText('@home')).toBeInTheDocument();
    expect(
      within(cards[1]!).getByText(/Oct \d{1,2}, 2026/),
    ).toBeInTheDocument();
    expect(within(cards[0]!).queryByText('@home')).not.toBeInTheDocument();
  });
});

describe('DeckDumpsPage states', () => {
  it('shows a loading state before the dumps arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/dumps$/)).not.toBeInTheDocument();

    await screen.findAllByRole('listitem');
  });

  it('invites you to dump when the deck has no dumps', async () => {
    mockedListDumps.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText(/no dumps with @casa yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dump/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });
});

describe('DeckDumpsPage errors', () => {
  it('shows the API error when the dumps cannot be loaded', async () => {
    mockedListDumps.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListDumps.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the dumps',
    );
  });

  it('reads the decoded deck from the URL', async () => {
    renderPage('/deck/caf%C3%A9');

    await screen.findAllByRole('listitem');

    expect(mockedListDumps).toHaveBeenCalledWith('café');
    expect(screen.getByRole('heading', { name: '@café' })).toBeInTheDocument();
  });
});

describe('DeckDumpsPage create', () => {
  it('starts the composer empty', async () => {
    renderPage();

    expect(
      await screen.findByRole('textbox', { name: 'New dump' }),
    ).toHaveValue('');
  });

  it('adds the new dump to the top of the list without refetching', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants @casa{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('water the plants @casa');
    const cards = await findCards();
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText('water the plants')).toBeInTheDocument();
    expect(screen.getByText('3 dumps')).toBeInTheDocument();
    expect(textarea).toHaveValue('');
    expect(mockedListDumps).toHaveBeenCalledTimes(1);
  });
});

describe('DeckDumpsPage create and the deck match', () => {
  it('matches the page deck ignoring case', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    });
    renderPage('/deck/Casa');
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants @Casa{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('water the plants @Casa');
    expect(await findCards()).toHaveLength(3);
  });

  it('adds a dump that carries the page deck along with other decks', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      decks: [
        { id: 'deck-9', name: 'outra' },
        { id: 'deck-1', name: 'casa' },
      ],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.clear(textarea);
    await user.type(textarea, 'water the plants @outra @casa{Enter}');

    expect(await findCards()).toHaveLength(3);
    const cards = await findCards();
    expect(within(cards[0]!).getByText('water the plants')).toBeInTheDocument();
  });

  it('leaves the list alone when the saved dump carries another deck', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      decks: [{ id: 'deck-9', name: 'outra' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.clear(textarea);
    await user.type(textarea, 'water the plants @outra{Enter}');

    await waitFor(() => expect(mockedCreateDump).toHaveBeenCalledTimes(1));
    expect(await findCards()).toHaveLength(2);
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });
});

describe('DeckDumpsPage create errors', () => {
  it('shows the composer error and keeps the draft when saving fails', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants @casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('water the plants @casa');
  });
});

describe('DeckDumpsPage edit', () => {
  it('edits a dump inline and keeps the order of the list', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();
    const editButton = within(first!).getByRole('button', {
      name: 'Edit dump',
    });
    expect(editButton.querySelector('svg')).not.toBeNull();

    await user.click(editButton);
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    expect(editor).toHaveValue('buy coffee');

    await user.clear(editor);
    await user.type(editor, 'buy tea @casa');
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(mockedUpdateDump).toHaveBeenCalledWith('dump-1', 'buy tea @casa');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy tea')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('fix the sink')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit dump' }),
    ).not.toBeInTheDocument();
  });

  it('saves with Enter, trimming the content', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      decks: [{ id: 'deck-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @casa {Enter}');

    expect(mockedUpdateDump).toHaveBeenCalledWith('dump-1', 'buy tea @casa');
    expect(await screen.findByText('buy tea')).toBeInTheDocument();
  });
});

describe('DeckDumpsPage edit cancelling', () => {
  it('cancels the edit on Escape without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'throw this away{Escape}');

    expect(mockedUpdateDump).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit dump' }),
    ).not.toBeInTheDocument();
  });

  it('cancels the edit on the Cancel button', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    await user.click(within(first!).getByRole('button', { name: 'Cancel' }));

    expect(mockedUpdateDump).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
  });
});

describe('DeckDumpsPage edit and the deck match', () => {
  it('drops the dump from the list when the deck leaves the content', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      decks: [{ id: 'deck-9', name: 'outra' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @outra{Enter}');

    expect(await screen.findByText('1 dump')).toBeInTheDocument();
    expect(screen.queryByText('buy tea')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText('fix the sink')).toBeInTheDocument();
    expect(screen.queryByText('buy coffee')).not.toBeInTheDocument();
  });
});

describe('DeckDumpsPage edit errors', () => {
  it('shows the API error inside the card and keeps the draft', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(
      within(first!).getByRole('textbox', { name: 'Edit dump' }),
    ).toHaveValue('buy tea @casa');
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('falls back to a generic message when the update fails without an error', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the dump',
    );
  });
});

describe('DeckDumpsPage delete', () => {
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    const deleteButton = within(first!).getByRole('button', {
      name: 'Delete dump',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteDump).not.toHaveBeenCalled();
    expect(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });

  it('deletes the dump on the second click', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(mockedDeleteDump).toHaveBeenCalledWith('dump-1');
    expect(await screen.findByText('1 dump')).toBeInTheDocument();
    expect(screen.queryByText('buy coffee')).not.toBeInTheDocument();
    expect(mockedListDumps).toHaveBeenCalledTimes(1);
  });

  it('drops the confirmation when the focus moves to another dump', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first, second] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(second!).getByRole('button', { name: 'Delete dump' }),
    );

    expect(
      within(first!).queryByRole('button', { name: 'Confirm delete' }),
    ).not.toBeInTheDocument();
    expect(
      within(second!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });
});

describe('DeckDumpsPage delete errors', () => {
  it('keeps the dump and shows the API error when the delete fails', async () => {
    const user = userEvent.setup();
    mockedDeleteDump.mockRejectedValue(new Error('Dump not found'));
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dump not found',
    );
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
    expect(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('falls back to a generic message when the delete fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteDump.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the dump',
    );
  });
});
