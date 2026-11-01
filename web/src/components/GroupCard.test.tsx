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
    renderCard('casa');

    expect(screen.getByRole('link', { name: /@casa/ })).toHaveAttribute(
      'href',
      '/app/group/casa',
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
