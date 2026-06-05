import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import Home from '@/src/app/page';

afterEach(() => {
  cleanup();
});

describe('Home', () => {
  it('parses, compares, and displays diff entries in a table', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(
      JSON.stringify({
        user: {
          name: 'Arnab',
          age: 30,
        },
        removed: true,
      }),
    );
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(
      JSON.stringify({
        user: {
          name: 'Arnab',
          age: 31,
        },
        added: 'new',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table');

    expect(within(table).getByText('added')).toBeInTheDocument();
    expect(within(table).getByText('ADDED')).toBeInTheDocument();
    expect(within(table).getByText('"new"')).toBeInTheDocument();
    expect(within(table).getByText('removed')).toBeInTheDocument();
    expect(within(table).getByText('REMOVED')).toBeInTheDocument();
    expect(within(table).getByText('user.age')).toBeInTheDocument();
    expect(within(table).getByText('CHANGED')).toBeInTheDocument();
    expect(within(table).getByText('30')).toBeInTheDocument();
    expect(within(table).getByText('31')).toBeInTheDocument();
  });

  it('shows a parse error for invalid JSON', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{bad json');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{"ok":true}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByText(/expected property name/i)).toBeInTheDocument();
  });
});
