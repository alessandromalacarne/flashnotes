import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DeckCard } from './DeckCard';

function renderCard(name: string) {
  return render(
    <MemoryRouter>
      <ul>
        <DeckCard deck={{ id: 'deck-1', name, count: 3 }} onDelete={vi.fn()} />
      </ul>
    </MemoryRouter>,
  );
}

describe('DeckCard', () => {
  it('links the deck to its page', () => {
    renderCard('casa');

    expect(screen.getByRole('link', { name: /@casa/ })).toHaveAttribute(
      'href',
      '/app/deck/casa',
    );
  });

  it('encodes the deck into the link', () => {
    renderCard('café');

    expect(screen.getByRole('link', { name: /@café/ })).toHaveAttribute(
      'href',
      '/app/deck/caf%C3%A9',
    );
  });
});
