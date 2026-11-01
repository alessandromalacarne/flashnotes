import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { GroupCard } from './GroupCard';

function renderCard(name: string) {
  return render(
    <MemoryRouter>
      <ul>
        <GroupCard
          group={{ id: 'group-1', name, count: 3 }}
          onDelete={vi.fn()}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe('GroupCard', () => {
  it('links the group to its page', () => {
    renderCard('home');

    expect(screen.getByRole('link', { name: /@home/ })).toHaveAttribute(
      'href',
      '/app/group/home',
    );
  });

  it('encodes the group into the link', () => {
    renderCard('café');

    expect(screen.getByRole('link', { name: /@café/ })).toHaveAttribute(
      'href',
      '/app/group/caf%C3%A9',
    );
  });
});
