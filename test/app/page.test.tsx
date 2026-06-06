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
  it('shows copyright and the developer repository link', () => {
    render(<Home />);

    expect(
      screen.getByText(`${new Date().getFullYear()} API Response Comparator`, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact developer' })).toHaveAttribute(
      'href',
      'https://github.com/arnabnandy7/api-response-comparator',
    );
  });

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

    const table = screen.getByRole('table', { name: 'Differences' });

    expect(within(table).getByText('added')).toBeInTheDocument();
    expect(within(table).getByText('ADDED')).toBeInTheDocument();
    expect(within(table).getByText('new')).toBeInTheDocument();
    expect(within(table).getByText('removed')).toBeInTheDocument();
    expect(within(table).getByText('REMOVED')).toBeInTheDocument();
    expect(within(table).getByText('user.age')).toBeInTheDocument();
    expect(within(table).getByText('CHANGED')).toBeInTheDocument();
    expect(within(table).getByText('30')).toBeInTheDocument();
    expect(within(table).getByText('31')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'API contract changes detected',
    );
  });

  it('merges value and schema changes into one result table', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({
      user: { id: 101, legacy: true },
      items: [{ price: 10 }],
    }));
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(JSON.stringify({
      user: { id: '101', email: 'arnab@example.com' },
      items: [{ price: '10' }, { price: '20' }],
    }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table', { name: 'Differences' });
    expect(within(table).getByText('user.email')).toBeInTheDocument();
    expect(within(table).getByText('user.id')).toBeInTheDocument();
    expect(within(table).getByText('user.legacy')).toBeInTheDocument();
    expect(within(table).getByText('items[0].price')).toBeInTheDocument();
    expect(within(table).getAllByText('TYPE_CHANGE')).toHaveLength(2);
    expect(screen.getByText('Type changes: 2')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Added, removed, or type-changed fields may require updates in API consumers.',
    );
    expect(
      screen.queryByRole('region', { name: 'Schema Differences' }),
    ).not.toBeInTheDocument();
  });

  it('does not show the contract alert for value-only changes', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{"user":{"age":30}}');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{"user":{"age":31}}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Changed: 1')).toBeInTheDocument();
  });

  it('filters differences by type and restores all results', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({
      removed: true,
      changed: 1,
      typed: 1,
    }));
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(JSON.stringify({
      added: true,
      changed: 2,
      typed: '1',
    }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table', { name: 'Differences' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show all: 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Added: 1' }));
    expect(within(table).getByText('added')).toBeInTheDocument();
    expect(within(table).queryByText('removed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Removed: 1' }));
    expect(within(table).getByText('removed')).toBeInTheDocument();
    expect(within(table).queryByText('added')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Changed: 1' }));
    expect(within(table).getByText('changed')).toBeInTheDocument();
    expect(within(table).queryByText('typed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Type changes: 1' }));
    expect(within(table).getByText('typed')).toBeInTheDocument();
    expect(within(table).queryByText('changed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all: 4' }));
    expect(within(table).getAllByRole('row')).toHaveLength(5);
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
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();
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

  it('downloads the diff as JSON when the JSON icon is clicked', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:api-diff');
    const revokeObjectURL = vi.fn();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{"value":1}');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{"value":2}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Download JSON' }));

    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/json' }),
    );
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:api-diff');
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

    const table = await screen.findByRole('table', { name: 'Differences' });
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

  it('generates and merges ignore rules for volatile fields', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste(JSON.stringify({
      stable: 'same',
      updatedAt: '2026-06-06T10:00:00Z',
      requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    }));
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste(JSON.stringify({
      stable: 'same',
      updatedAt: '2026-06-06T10:01:00Z',
      requestId: '9b2de3a0-42f5-4c6f-9227-701f2a662c52',
    }));
    await user.type(screen.getByLabelText('Ignore fields'), 'existingField');

    await user.click(screen.getByRole('button', { name: 'Generate Ignore Rules' }));

    expect(screen.getByLabelText('Ignore fields')).toHaveValue(
      'existingField, requestId, updatedAt',
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Generated 2 ignore rules');
    const suggestions = screen.getByLabelText('Generated ignore suggestions');
    expect(within(suggestions).getByText('requestId')).toBeInTheDocument();
    expect(within(suggestions).getByText('updatedAt')).toBeInTheDocument();
    expect(within(suggestions).getAllByText('High confidence')).toHaveLength(2);
  });

  it('clears ignore fields and suggestions when either source JSON changes', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const jsonA = screen.getByLabelText('JSON A');
    const jsonB = screen.getByLabelText('JSON B');

    await user.click(jsonA);
    await user.paste(JSON.stringify({
      updatedAt: '2026-06-06T10:00:00Z',
    }));
    await user.click(jsonB);
    await user.paste(JSON.stringify({
      updatedAt: '2026-06-06T10:01:00Z',
    }));
    await user.click(screen.getByRole('button', { name: 'Generate Ignore Rules' }));

    expect(screen.getByLabelText('Ignore fields')).toHaveValue('updatedAt');
    expect(screen.getByLabelText('Generated ignore suggestions')).toBeInTheDocument();

    await user.type(jsonA, ' ');

    expect(screen.getByLabelText('Ignore fields')).toHaveValue('');
    expect(
      screen.queryByLabelText('Generated ignore suggestions'),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Ignore fields'), 'manualRule');
    await user.type(jsonB, ' ');

    expect(screen.getByLabelText('Ignore fields')).toHaveValue('');
  });

  it('hides stale results when either source JSON changes', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const jsonA = screen.getByLabelText('JSON A');
    const jsonB = screen.getByLabelText('JSON B');

    await user.click(jsonA);
    await user.paste('{"value":1}');
    await user.click(jsonB);
    await user.paste('{"value":2}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.type(jsonA, ' ');

    expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.clear(jsonA);
    await user.click(jsonA);
    await user.paste('{"value":1}');
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();

    await user.type(jsonB, ' ');

    expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
  });

  it('validates JSON before generating ignore rules', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('JSON A'));
    await user.paste('{bad json');
    await user.click(screen.getByLabelText('JSON B'));
    await user.paste('{"ok":true}');
    await user.click(screen.getByRole('button', { name: 'Generate Ignore Rules' }));

    expect(screen.getByText('Invalid JSON in Response A')).toBeInTheDocument();
    expect(screen.getByLabelText('Ignore fields')).toHaveValue('');
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
