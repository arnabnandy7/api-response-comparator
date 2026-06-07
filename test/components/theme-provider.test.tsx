import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { nextThemeProvider } = vi.hoisted(() => ({
  nextThemeProvider: vi.fn(
    ({ children, attribute }: { children: React.ReactNode; attribute?: string }) => (
      <section data-attribute={attribute} data-testid="next-theme-provider">
        {children}
      </section>
    ),
  ),
}));

vi.mock('next-themes', () => ({
  ThemeProvider: nextThemeProvider,
}));

import { ThemeProvider } from '@/src/components/theme-provider';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ThemeProvider', () => {
  it('renders children through next-themes with forwarded props', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <p>App content</p>
      </ThemeProvider>,
    );

    expect(screen.getByText('App content')).toBeInTheDocument();
    expect(screen.getByTestId('next-theme-provider')).toHaveAttribute(
      'data-attribute',
      'class',
    );
    expect(nextThemeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'system',
        enableSystem: true,
      }),
      undefined,
    );
  });
});
