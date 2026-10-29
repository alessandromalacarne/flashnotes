import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('landing page', () => {
  it('presents quickdump and the paths into the app', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /capture thoughts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /start dumping/i }),
    ).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
