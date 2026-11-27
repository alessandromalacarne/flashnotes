import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getCurrentUser, signIn } from '../api';
import type { WorkerRequest, WorkerResponse } from '../local/protocol';

vi.mock('../api', () => ({
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  startDemo: vi.fn(),
}));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly posted: WorkerRequest[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(request: WorkerRequest): void {
    this.posted.push(request);
    this.onmessage?.({
      data: { id: request.id, ok: true, result: [] },
    } as MessageEvent<WorkerResponse>);
  }
}

const ana = { id: 'user-1', email: 'ana@example.com', isDemo: false };

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(signIn).mockResolvedValue(ana);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth restoration for the local store', () => {
  it('forwards guest notes to the browser database and account notes to the user database', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const guestComposer = await screen.findByRole('textbox', {
      name: /new note/i,
    });
    await user.type(guestComposer, 'buy coffee @home{Shift>}{Enter}{/Shift}');

    expect(await screen.findByText('note saved')).toBeInTheDocument();
    const worker = FakeWorker.instances[0]!;
    expect(worker.posted[0]).toMatchObject({
      op: 'createNote',
      userId: 'browser-local',
    });

    await user.click(
      within(screen.getByRole('navigation', { name: /account/i })).getByRole(
        'link',
        { name: /sign in/i },
      ),
    );
    await user.type(await screen.findByLabelText(/email/i), ana.email);
    await user.type(
      screen.getByLabelText(/password/i),
      'correct horse battery',
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const accountComposer = await screen.findByRole('textbox', {
      name: /note/i,
    });
    await user.type(accountComposer, 'tea @work{Shift>}{Enter}{/Shift}');

    expect(await screen.findByText('note saved')).toBeInTheDocument();
    expect(worker.posted[1]).toMatchObject({
      op: 'createNote',
      userId: 'user-1',
    });
  });
});
