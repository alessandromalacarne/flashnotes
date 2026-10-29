import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDeck, listDecks } from '../api';
import { DecksPage } from './DecksPage';

vi.mock('../api', () => ({
  listDecks: vi.fn(),
  deleteDeck: vi.fn(),
}));

const mockedListDecks = vi.mocked(listDecks);
const mockedDeleteDeck = vi.mocked(deleteDeck);

const decks = [
  { id: 'deck-1', name: 'casa', count: 3 },
  { id: 'deck-2', name: 'trabalho', count: 1 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <DecksPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListDecks.mockResolvedValue(decks);
  mockedDeleteDeck.mockResolvedValue(undefined);
});

describe('DecksPage', () => {
  it('lists every deck with its dump count', async () => {
    renderPage();

    const casa = await screen.findByRole('listitem', { name: /casa/ });
    expect(within(casa).getByText('@casa')).toBeInTheDocument();
    expect(within(casa).getByText('3 dumps')).toBeInTheDocument();

    const trabalho = screen.getByRole('listitem', { name: /trabalho/ });
    expect(within(trabalho).getByText('@trabalho')).toBeInTheDocument();
    expect(within(trabalho).getByText('1 dump')).toBeInTheDocument();
  });

  it('shows a loading state before the decks arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();

    await screen.findByRole('listitem', { name: /casa/ });
  });

  it('invites you to dump when there are no decks', async () => {
    mockedListDecks.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no decks yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dump/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });
});

describe('DecksPage deletion', () => {
  it('deletes a deck and drops it from the grid', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    const deleteButton = screen.getByRole('button', {
      name: 'Delete deck @casa',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteDeck).toHaveBeenCalledWith('deck-1');
    expect(
      await screen.findByRole('listitem', { name: /trabalho/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('@casa')).not.toBeInTheDocument();
    expect(mockedListDecks).toHaveBeenCalledTimes(1);
  });
});

describe('DecksPage errors', () => {
  it('shows the API error when the decks cannot be loaded', async () => {
    mockedListDecks.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('keeps the deck and shows the error when deleting fails', async () => {
    const user = userEvent.setup();
    mockedDeleteDeck.mockRejectedValue(new Error('Deck not found'));
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(screen.getByRole('button', { name: 'Delete deck @casa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Deck not found',
    );
    expect(screen.getByText('@casa')).toBeInTheDocument();
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListDecks.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the decks',
    );
  });

  it('falls back to a generic message when deleting fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteDeck.mockRejectedValue('boom');
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(screen.getByRole('button', { name: 'Delete deck @casa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the deck',
    );
  });
});
