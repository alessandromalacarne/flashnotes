import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App';

/**
 * Step definitions for contracts/demo-account.feature, web side.
 *
 * Fixtures and the render helper live here; the module mocks stay in the spec
 * because `vi.mock` is hoisted per file.
 */

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@flashnotes.app',
  isDemo: true,
};

export const ACCOUNT_USER = {
  id: 'user-1',
  email: 'ana@example.com',
  isDemo: false,
};

export function renderApp(path = '/', state?: unknown) {
  return render(
    <MemoryRouter
      initialEntries={[state === undefined ? path : { pathname: path, state }]}
    >
      <App />
    </MemoryRouter>,
  );
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
