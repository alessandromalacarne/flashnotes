import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteGroup, listGroups } from '../api';
import { GroupsPage } from './GroupsPage';

vi.mock('../api', () => ({
  listGroups: vi.fn(),
  deleteGroup: vi.fn(),
}));

const mockedListGroups = vi.mocked(listGroups);
const mockedDeleteGroup = vi.mocked(deleteGroup);

const groups = [
  { id: 'group-1', name: 'casa', count: 3 },
  { id: 'group-2', name: 'trabalho', count: 1 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListGroups.mockResolvedValue(groups);
  mockedDeleteGroup.mockResolvedValue(undefined);
});

describe('GroupsPage', () => {
  it('lists every group with its note count', async () => {
    renderPage();

    const casa = await screen.findByRole('listitem', { name: /casa/ });
    expect(within(casa).getByText('@casa')).toBeInTheDocument();
    expect(within(casa).getByText('3 notes')).toBeInTheDocument();

    const trabalho = screen.getByRole('listitem', { name: /trabalho/ });
    expect(within(trabalho).getByText('@trabalho')).toBeInTheDocument();
    expect(within(trabalho).getByText('1 note')).toBeInTheDocument();
  });

  it('shows a loading state before the groups arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();

    await screen.findByRole('listitem', { name: /casa/ });
  });

  it('invites you to note when there are no groups', async () => {
    mockedListGroups.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no groups yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /note/i })).toHaveAttribute(
      'href',
      '/app',
    );
  });
});

describe('GroupsPage deletion', () => {
  it('deletes a group and drops it from the grid', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    const deleteButton = screen.getByRole('button', {
      name: 'Delete group @casa',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteGroup).toHaveBeenCalledWith('group-1');
    expect(
      await screen.findByRole('listitem', { name: /trabalho/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('@casa')).not.toBeInTheDocument();
    expect(mockedListGroups).toHaveBeenCalledTimes(1);
  });
});

describe('GroupsPage errors', () => {
  it('shows the API error when the groups cannot be loaded', async () => {
    mockedListGroups.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('keeps the group and shows the error when deleting fails', async () => {
    const user = userEvent.setup();
    mockedDeleteGroup.mockRejectedValue(new Error('Group not found'));
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(
      screen.getByRole('button', { name: 'Delete group @casa' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Group not found',
    );
    expect(screen.getByText('@casa')).toBeInTheDocument();
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListGroups.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the groups',
    );
  });

  it('falls back to a generic message when deleting fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteGroup.mockRejectedValue('boom');
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(
      screen.getByRole('button', { name: 'Delete group @casa' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the group',
    );
  });
});
