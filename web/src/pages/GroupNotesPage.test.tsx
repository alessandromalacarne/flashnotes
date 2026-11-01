import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNote, deleteNote, listNotes, updateNote } from '../api';
import { GroupNotesPage } from './GroupNotesPage';

vi.mock('../api', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
}));

const mockedCreateNote = vi.mocked(createNote);
const mockedDeleteNote = vi.mocked(deleteNote);
const mockedListNotes = vi.mocked(listNotes);
const mockedUpdateNote = vi.mocked(updateNote);

const notes = [
  {
    id: 'note-1',
    content: 'buy coffee',
    createdAt: '2026-10-14T12:00:00.000Z',
    groups: [{ id: 'group-1', name: 'casa' }],
  },
  {
    id: 'note-2',
    content: 'fix the sink',
    createdAt: '2026-10-13T09:30:00.000Z',
    groups: [
      { id: 'group-1', name: 'casa' },
      { id: 'group-2', name: 'home' },
    ],
  },
];

function renderPage(path = '/group/casa') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/group/:group" element={<GroupNotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findCards() {
  return screen.findAllByRole('listitem');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListNotes.mockResolvedValue(notes);
  mockedDeleteNote.mockResolvedValue(undefined);
});

describe('GroupNotesPage', () => {
  it('shows the notes of the group from the URL', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy coffee')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('fix the sink')).toBeInTheDocument();
  });

  it('heads the page with the group and how many notes it holds', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: '@casa' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 notes')).toBeInTheDocument();
  });

  it('uses the singular for a single note', async () => {
    mockedListNotes.mockResolvedValue([notes[0]!]);
    renderPage();

    expect(await screen.findByText('1 note')).toBeInTheDocument();
  });

  it('shows the groups and the date of each note', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(within(cards[1]!).getByText('@home')).toBeInTheDocument();
    expect(
      within(cards[1]!).getByText(/Oct \d{1,2}, 2026/),
    ).toBeInTheDocument();
    expect(within(cards[0]!).queryByText('@home')).not.toBeInTheDocument();
  });
});

describe('GroupNotesPage states', () => {
  it('shows a loading state before the notes arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/notes$/)).not.toBeInTheDocument();

    await screen.findAllByRole('listitem');
  });

  it('invites you to note when the group has no notes', async () => {
    mockedListNotes.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText(/no notes with @casa yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /note/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });
});

describe('GroupNotesPage errors', () => {
  it('shows the API error when the notes cannot be loaded', async () => {
    mockedListNotes.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListNotes.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the notes',
    );
  });

  it('reads the decoded group from the URL', async () => {
    renderPage('/group/caf%C3%A9');

    await screen.findAllByRole('listitem');

    expect(mockedListNotes).toHaveBeenCalledWith('café');
    expect(screen.getByRole('heading', { name: '@café' })).toBeInTheDocument();
  });
});

describe('GroupNotesPage create', () => {
  it('starts the composer empty', async () => {
    renderPage();

    expect(
      await screen.findByRole('textbox', { name: 'New note' }),
    ).toHaveValue('');
  });

  it('adds the new note to the top of the list without refetching', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockResolvedValue({
      id: 'note-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New note' });

    await user.type(textarea, 'water the plants @casa{Enter}');

    expect(mockedCreateNote).toHaveBeenCalledWith('water the plants @casa');
    const cards = await findCards();
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText('water the plants')).toBeInTheDocument();
    expect(screen.getByText('3 notes')).toBeInTheDocument();
    expect(textarea).toHaveValue('');
    expect(mockedListNotes).toHaveBeenCalledTimes(1);
  });
});

describe('GroupNotesPage create and the group match', () => {
  it('matches the page group ignoring case', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockResolvedValue({
      id: 'note-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    });
    renderPage('/group/Casa');
    const textarea = await screen.findByRole('textbox', { name: 'New note' });

    await user.type(textarea, 'water the plants @Casa{Enter}');

    expect(mockedCreateNote).toHaveBeenCalledWith('water the plants @Casa');
    expect(await findCards()).toHaveLength(3);
  });

  it('adds a note that carries the page group along with other groups', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockResolvedValue({
      id: 'note-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      groups: [
        { id: 'group-9', name: 'outra' },
        { id: 'group-1', name: 'casa' },
      ],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New note' });

    await user.clear(textarea);
    await user.type(textarea, 'water the plants @outra @casa{Enter}');

    expect(await findCards()).toHaveLength(3);
    const cards = await findCards();
    expect(within(cards[0]!).getByText('water the plants')).toBeInTheDocument();
  });

  it('leaves the list alone when the saved note carries another group', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockResolvedValue({
      id: 'note-3',
      content: 'water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      groups: [{ id: 'group-9', name: 'outra' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New note' });

    await user.clear(textarea);
    await user.type(textarea, 'water the plants @outra{Enter}');

    await waitFor(() => expect(mockedCreateNote).toHaveBeenCalledTimes(1));
    expect(await findCards()).toHaveLength(2);
    expect(screen.getByText('2 notes')).toBeInTheDocument();
  });
});

describe('GroupNotesPage create errors', () => {
  it('shows the composer error and keeps the draft when saving fails', async () => {
    const user = userEvent.setup();
    mockedCreateNote.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New note' });

    await user.type(textarea, 'water the plants @casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('water the plants @casa');
  });
});

describe('GroupNotesPage edit', () => {
  it('edits a note inline and keeps the order of the list', async () => {
    const user = userEvent.setup();
    mockedUpdateNote.mockResolvedValue({
      id: 'note-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();
    const editButton = within(first!).getByRole('button', {
      name: 'Edit note',
    });
    expect(editButton.querySelector('svg')).not.toBeNull();

    await user.click(editButton);
    const editor = within(first!).getByRole('textbox', { name: 'Edit note' });
    expect(editor).toHaveValue('buy coffee');

    await user.clear(editor);
    await user.type(editor, 'buy tea @casa');
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(mockedUpdateNote).toHaveBeenCalledWith('note-1', 'buy tea @casa');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy tea')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('fix the sink')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit note' }),
    ).not.toBeInTheDocument();
  });

  it('saves with Enter, trimming the content', async () => {
    const user = userEvent.setup();
    mockedUpdateNote.mockResolvedValue({
      id: 'note-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      groups: [{ id: 'group-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit note' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @casa {Enter}');

    expect(mockedUpdateNote).toHaveBeenCalledWith('note-1', 'buy tea @casa');
    expect(await screen.findByText('buy tea')).toBeInTheDocument();
  });
});

describe('GroupNotesPage edit cancelling', () => {
  it('cancels the edit on Escape without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit note' });
    await user.clear(editor);
    await user.type(editor, 'throw this away{Escape}');

    expect(mockedUpdateNote).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit note' }),
    ).not.toBeInTheDocument();
  });

  it('cancels the edit on the Cancel button', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    await user.click(within(first!).getByRole('button', { name: 'Cancel' }));

    expect(mockedUpdateNote).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
  });
});

describe('GroupNotesPage edit and the group match', () => {
  it('drops the note from the list when the group leaves the content', async () => {
    const user = userEvent.setup();
    mockedUpdateNote.mockResolvedValue({
      id: 'note-1',
      content: 'buy tea',
      createdAt: '2026-10-14T12:00:00.000Z',
      groups: [{ id: 'group-9', name: 'outra' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit note' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @outra{Enter}');

    expect(await screen.findByText('1 note')).toBeInTheDocument();
    expect(screen.queryByText('buy tea')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText('fix the sink')).toBeInTheDocument();
    expect(screen.queryByText('buy coffee')).not.toBeInTheDocument();
  });
});

describe('GroupNotesPage edit errors', () => {
  it('shows the API error inside the card and keeps the draft', async () => {
    const user = userEvent.setup();
    mockedUpdateNote.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit note' });
    await user.clear(editor);
    await user.type(editor, 'buy tea @casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(
      within(first!).getByRole('textbox', { name: 'Edit note' }),
    ).toHaveValue('buy tea @casa');
    expect(screen.getByText('2 notes')).toBeInTheDocument();
  });

  it('falls back to a generic message when the update fails without an error', async () => {
    const user = userEvent.setup();
    mockedUpdateNote.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit note' }));
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the note',
    );
  });
});

describe('GroupNotesPage delete', () => {
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    const deleteButton = within(first!).getByRole('button', {
      name: 'Delete note',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteNote).not.toHaveBeenCalled();
    expect(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });

  it('deletes the note on the second click', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete note' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(mockedDeleteNote).toHaveBeenCalledWith('note-1');
    expect(await screen.findByText('1 note')).toBeInTheDocument();
    expect(screen.queryByText('buy coffee')).not.toBeInTheDocument();
    expect(mockedListNotes).toHaveBeenCalledTimes(1);
  });

  it('drops the confirmation when the focus moves to another note', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first, second] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete note' }),
    );
    await user.click(
      within(second!).getByRole('button', { name: 'Delete note' }),
    );

    expect(
      within(first!).queryByRole('button', { name: 'Confirm delete' }),
    ).not.toBeInTheDocument();
    expect(
      within(second!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });
});

describe('GroupNotesPage delete errors', () => {
  it('keeps the note and shows the API error when the delete fails', async () => {
    const user = userEvent.setup();
    mockedDeleteNote.mockRejectedValue(new Error('Note not found'));
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete note' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Note not found',
    );
    expect(within(first!).getByText('buy coffee')).toBeInTheDocument();
    expect(
      within(first!).getByRole('button', { name: 'Delete note' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 notes')).toBeInTheDocument();
  });

  it('falls back to a generic message when the delete fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteNote.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete note' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the note',
    );
  });
});
