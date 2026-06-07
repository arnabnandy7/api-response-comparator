import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { themeProvider } = vi.hoisted(() => ({
  themeProvider: vi.fn(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="theme-provider">{children}</div>
    ),
  ),
}));

vi.mock('@/src/components/theme-provider', () => ({
  ThemeProvider: themeProvider,
}));

import RootLayout, { metadata } from '@/src/app/layout';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RootLayout', () => {
  it('exports page metadata', () => {
    expect(metadata).toEqual({
      title: 'API Response Comparator',
      description:
        'Compare JSON API responses across Dev, QA, and Prod using JSON, URLs, or cURL.',
    });
  });

  it('renders children inside the theme provider', () => {
    render(
      <RootLayout>
        <main>Comparator app</main>
      </RootLayout>,
    );

    expect(screen.getByText('Comparator app')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(themeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'system',
        enableSystem: true,
      }),
      undefined,
    );
  });
});
