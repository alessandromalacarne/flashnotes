/**
 * Contract: contracts/demo-account.feature
 *
 * Web-side scenarios: entry points, demo-mode UI and local data lifecycle.
 * Scenarios that need a real browser (OPFS) or the demo data module are listed
 * as pending at the bottom, with the feature section they come from.
 *
 * Seams proposed by this suite (veto at review):
 *   - api.startDemo(): POST /api/auth/demo and return the user
 *   - local/store.prepareDemoData(userId): clear + write the sample set
 *   - local/store.clearDemoData(userId): delete the demo database
 * The sample dataset itself is asserted by the local demo-data unit test.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_USER,
  DEMO_USER,
  deferred,
  renderApp,
} from './test/demo-account.steps';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  startDemo: vi.fn(),
  prepareDemoData: vi.fn(),
  clearDemoData: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  deleteGroup: vi.fn(),
  listNotes: vi.fn(),
  listGroups: vi.fn(),
  setLocalUser: vi.fn(),
}));

vi.mock('./api', () => ({
  getCurrentUser: mocks.getCurrentUser,
  signIn: mocks.signIn,
  signUp: mocks.signUp,
  signOut: mocks.signOut,
  startDemo: mocks.startDemo,
}));

vi.mock('./local/store', () => ({
  createNote: mocks.createNote,
  updateNote: mocks.updateNote,
  deleteNote: mocks.deleteNote,
  deleteGroup: mocks.deleteGroup,
  listNotes: mocks.listNotes,
  listGroups: mocks.listGroups,
  setLocalUser: mocks.setLocalUser,
  prepareDemoData: mocks.prepareDemoData,
  clearDemoData: mocks.clearDemoData,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.startDemo.mockResolvedValue(DEMO_USER);
  mocks.prepareDemoData.mockResolvedValue(undefined);
  mocks.clearDemoData.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue(undefined);
  mocks.listNotes.mockResolvedValue([]);
  mocks.listGroups.mockResolvedValue([]);
});

describe('Entry points', () => {
  // Feature: The landing page enters the demo with one click
  it('the landing page enters the demo with one click', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Try demo' }));

    expect(mocks.startDemo).toHaveBeenCalledTimes(1);
    expect(mocks.prepareDemoData).toHaveBeenCalledWith(DEMO_USER.id);
    expect(
      await screen.findByRole('status', { name: 'Demo mode' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /note/i })).toBeInTheDocument();
  });

  // Feature: The login page enters the demo and honours the return path
  it('the login page enters the demo and honours the return path', async () => {
    const user = userEvent.setup();
    renderApp('/login', { from: '/app/groups' });

    await user.click(await screen.findByRole('button', { name: 'Try demo' }));

    expect(
      await screen.findByRole('heading', { name: 'groups' }),
    ).toBeInTheDocument();
    expect(mocks.listGroups).toHaveBeenCalled();
  });

  // Feature: Repeated clicks do not create extra sessions
  it('repeated clicks do not create extra sessions', async () => {
    const pending = deferred<typeof DEMO_USER>();
    mocks.startDemo.mockReturnValue(pending.promise);

    const user = userEvent.setup();
    renderApp('/');

    const control = await screen.findByRole('button', { name: 'Try demo' });
    await user.click(control);

    expect(control).toBeDisabled();
    await user.click(control);
    expect(mocks.startDemo).toHaveBeenCalledTimes(1);

    pending.resolve(DEMO_USER);
    await screen.findByRole('textbox', { name: /note/i });
  });

  // Feature: A failed demo entry stays on the page
  it('a failed demo entry stays on the page and explains why', async () => {
    mocks.startDemo.mockRejectedValue(new Error('Demo is not available'));

    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Try demo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demo is not available',
    );
    expect(
      screen.getByRole('heading', { name: /capture thoughts/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Demo mode' }),
    ).not.toBeInTheDocument();
    expect(mocks.prepareDemoData).not.toHaveBeenCalled();
  });

  // Feature: Signed-in visitors are not offered the demo
  it('signed-in visitors are not offered the demo', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);

    renderApp('/');
    await within(
      screen.getByRole('navigation', { name: /account/i }),
    ).findByRole('link', { name: 'sign in' });

    expect(
      screen.queryByRole('button', { name: 'Try demo' }),
    ).not.toBeInTheDocument();
  });
});

describe('Demo-mode banner', () => {
  // Feature: The banner explains demo mode on every app route
  it.each(['/app', '/app/groups', '/app/group/home'])(
    'the banner explains demo mode on %s',
    async (path) => {
      mocks.getCurrentUser.mockResolvedValue(DEMO_USER);

      renderApp(path);

      const banner = await screen.findByRole('status', { name: 'Demo mode' });
      expect(banner).toHaveTextContent(/browser/i);
      expect(banner).toHaveTextContent(/removed on sign out/i);
      expect(
        screen.getByRole('button', { name: 'Reset demo data' }),
      ).toBeInTheDocument();
    },
  );

  // Feature: Real accounts see no demo banner
  it('real accounts see no demo banner', async () => {
    mocks.getCurrentUser.mockResolvedValue(ACCOUNT_USER);

    renderApp('/app');
    await screen.findByRole('textbox', { name: /note/i });

    expect(
      screen.queryByRole('status', { name: 'Demo mode' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset demo data' }),
    ).not.toBeInTheDocument();
  });

  // Feature: The demo controls are keyboard operable and named
  it('the demo controls are named and enabled', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);

    renderApp('/app');

    const banner = await screen.findByRole('status', { name: 'Demo mode' });
    const reset = screen.getByRole('button', { name: 'Reset demo data' });

    expect(banner).toBeVisible();
    expect(reset).toBeEnabled();
  });
});

describe('Demo local data lifecycle', () => {
  // Feature: Reset restores the seed set without ending the session
  it('reset asks for confirmation, then re-prepares the demo data', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);
    const user = userEvent.setup();

    renderApp('/app');
    await user.click(
      await screen.findByRole('button', { name: 'Reset demo data' }),
    );
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(mocks.prepareDemoData).toHaveBeenCalledWith(DEMO_USER.id);
    expect(mocks.startDemo).not.toHaveBeenCalled();
    expect(
      screen.getByRole('status', { name: 'Demo mode' }),
    ).toBeInTheDocument();
  });

  // Feature: Cancelling the reset keeps the demo data
  it('cancelling the reset keeps the demo data', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);
    const user = userEvent.setup();

    renderApp('/app');
    await user.click(
      await screen.findByRole('button', { name: 'Reset demo data' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.prepareDemoData).not.toHaveBeenCalled();
  });

  // Feature: Signing out of the demo removes its local data
  it('signing out of the demo clears its local data', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);
    const user = userEvent.setup();

    renderApp('/app');
    await user.click(await screen.findByRole('button', { name: 'sign out' }));

    expect(mocks.clearDemoData).toHaveBeenCalledWith(DEMO_USER.id);
  });

  // Feature: The demo never touches a real account's local data
  it('signing out of a real account clears nothing', async () => {
    mocks.getCurrentUser.mockResolvedValue(ACCOUNT_USER);
    const user = userEvent.setup();

    renderApp('/app');
    await user.click(await screen.findByRole('button', { name: 'sign out' }));

    expect(mocks.clearDemoData).not.toHaveBeenCalled();
  });

  // Feature: Reloading keeps the demo data instead of re-seeding it
  it('mounting an existing demo session does not re-seed', async () => {
    mocks.getCurrentUser.mockResolvedValue(DEMO_USER);

    renderApp('/app');
    await screen.findByRole('textbox', { name: /note/i });

    expect(mocks.prepareDemoData).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pending: needs the demo data module or a real browser (OPFS), so it cannot
// run in jsdom yet. Each entry names its scenario in the contract.
// ---------------------------------------------------------------------------

describe('Pending contract scenarios', () => {
  it.todo(
    'entering the demo seeds the sample set: 7 notes, @home 2, @work 2, @ideas 3',
  );
  it.todo('entry after an ended demo session still starts from the seed');
  it.todo('signing out removes the demo database from OPFS');
  it.todo('demo writes stay local and never call /api/notes or /api/groups');
  it.todo('demo data survives a browser restart while the session lasts');
  it.todo('unavailable local storage fails loudly and keeps the demo session');
  it.todo('entry plus seeding renders the sample set within 1 s at p95');
});
