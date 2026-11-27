import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('landing page', () => {
  it('presents flashnotes and the paths into the app', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /capture thoughts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create an account/i }),
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.getByRole('textbox', { name: /new note/i }),
    ).toBeInTheDocument();
    const accountNav = screen.getByRole('navigation', { name: /account/i });
    expect(
      within(accountNav).getByRole('link', { name: /sign in/i }),
    ).toHaveAttribute('href', '/login');
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /sign in/i }),
    ).toHaveAttribute('href', '/login');
  });
});
