import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('exceljs', () => {
  // Use a regular function implementation so it can be used as a constructor with `new Workbook()`
  const Workbook = vi.fn().mockImplementation(function () {
    return {
      addWorksheet: vi.fn(() => ({
        addRow: vi.fn(() => ({ height: 0, eachCell: vi.fn() })),
        getRow: vi.fn(() => ({ eachCell: vi.fn() })),
        columns: [],
      })),
      xlsx: { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) },
    };
  });
  return {
    __esModule: true,
    Workbook,
  };
});

import * as ExcelJS from 'exceljs';
import Home from '@/src/app/page';

afterEach(() => {
  cleanup();
  // restore any global stubs (e.g. fetch) between tests
  try {
    vi.unstubAllGlobals();
  } catch {
    // no-op if not supported in this environment
  }
  vi.restoreAllMocks();
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
    expect(within(table).getByText('new')).toBeInTheDocument();
    expect(within(table).getByText('removed')).toBeInTheDocument();
    expect(within(table).getByText('REMOVED')).toBeInTheDocument();
    expect(within(table).getByText('user.age')).toBeInTheDocument();
    expect(within(table).getByText('CHANGED')).toBeInTheDocument();
    expect(within(table).getByText('30')).toBeInTheDocument();
    expect(within(table).getByText('31')).toBeInTheDocument();
  });

  it('shows the download Excel button alongside Copy Diff after compare', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({ user: { name: 'Arnab', age: 30 } }));
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(JSON.stringify({ user: { name: 'Arnab', age: 31 } }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('button', { name: 'Copy Diff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Excel' })).toBeInTheDocument();
  });

  it('downloads the diff as excel when the button is clicked', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({ user: { name: 'Arnab', age: 30 } }));
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(JSON.stringify({ user: { name: 'Arnab', age: 31 } }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Download Excel' }));

    // Workbook should be created and written to buffer
    expect(ExcelJS.Workbook).toHaveBeenCalled();
    const wbInstance = (ExcelJS.Workbook as unknown as vi.Mock).mock.results[0].value;
    expect(wbInstance.xlsx.writeBuffer).toHaveBeenCalled();
  });

  it('fetches two URLs and compares responses', async () => {
    const user = userEvent.setup();

    const respA = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ user: { name: 'Arnab', age: 30 } }),
    };
    const respB = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ user: { name: 'Arnab', age: 31 }, added: 'new' }),
    };

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const requestUrl = new URL(url, 'http://localhost');
      if (requestUrl.pathname === '/api/proxy') {
        const target = requestUrl.searchParams.get('url');
        if (target === 'https://api.a.test') return Promise.resolve(respA as any);
        if (target === 'https://api.b.test') return Promise.resolve(respB as any);
      }

      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found', text: async () => '' } as any);
    }));

    render(<Home />);

    await user.type(screen.getByPlaceholderText('API URL A (optional)'), 'https://api.a.test');
    await user.type(screen.getByPlaceholderText('API URL B (optional)'), 'https://api.b.test');

    await user.click(screen.getByRole('button', { name: 'Fetch & Compare' }));

    // after fetch, textareas should be populated and results shown
    expect(screen.getByLabelText('JSON A')).toHaveValue(JSON.stringify({ user: { name: 'Arnab', age: 30 } }, null, 2));
    expect(screen.getByLabelText('JSON B')).toHaveValue(JSON.stringify({ user: { name: 'Arnab', age: 31 }, added: 'new' }, null, 2));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('user.age')).toBeInTheDocument();
    expect(within(table).getByText('CHANGED')).toBeInTheDocument();
    expect(within(table).getByText('added')).toBeInTheDocument();
    expect(within(table).getByText('ADDED')).toBeInTheDocument();
  });

  it('clears each API URL independently', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const urlA = screen.getByLabelText('API URL A');
    const urlB = screen.getByLabelText('API URL B');

    await user.type(urlA, 'https://api.a.test');
    await user.type(urlB, 'https://api.b.test');
    await user.click(screen.getByRole('button', { name: 'Clear API URL A' }));

    expect(urlA).toHaveValue('');
    expect(urlB).toHaveValue('https://api.b.test');
    expect(screen.queryByRole('button', { name: 'Clear API URL A' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear API URL B' }));

    expect(urlB).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear API URL B' })).not.toBeInTheDocument();
  });

  it('shows a response A validation error for invalid JSON', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{bad json');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{"ok":true}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByText('Invalid JSON in Response A')).toBeInTheDocument();
  });

  it('shows a response B validation error for invalid JSON', async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{"ok":true}');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{bad json');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByText('Invalid JSON in Response B')).toBeInTheDocument();
  });

  it('loads JSON from uploaded files and compares successfully', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const fileA = new File(
      [JSON.stringify({ user: { name: 'Arnab', age: 30 } })],
      'response-a.json',
      { type: 'application/json' },
    );
    const fileB = new File(
      [JSON.stringify({ user: { name: 'Arnab', age: 31 } })],
      'response-b.json',
      { type: 'application/json' },
    );

    await user.upload(screen.getByLabelText('Upload JSON A'), fileA);
    await user.upload(screen.getByLabelText('Upload JSON B'), fileB);

    expect(screen.getByLabelText('JSON A')).toHaveValue(
      JSON.stringify({ user: { name: 'Arnab', age: 30 } }),
    );
    expect(screen.getByLabelText('JSON B')).toHaveValue(
      JSON.stringify({ user: { name: 'Arnab', age: 31 } }),
    );

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table');
    expect(within(table).getByText('user.age')).toBeInTheDocument();
    expect(within(table).getByText('CHANGED')).toBeInTheDocument();
  });

  it('loads JSON from uploaded file and shows toast notification', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const fileA = new File(
      [JSON.stringify({ user: { name: 'Arnab', age: 30 } })],
      'response-a.json',
      { type: 'application/json' },
    );

    await user.upload(screen.getByLabelText('Upload JSON A'), fileA);

    expect(screen.getByLabelText('JSON A')).toHaveValue(
      JSON.stringify({ user: { name: 'Arnab', age: 30 } }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Loaded response-a.json',
    );
  });

  it('clears JSON A when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({ ok: true }));

    expect(screen.getByLabelText('JSON A')).toHaveValue(JSON.stringify({ ok: true }));

    await user.click(screen.getByRole('button', { name: 'Clear JSON A' }));

    expect(screen.getByLabelText('JSON A')).toHaveValue('');
  });
});
