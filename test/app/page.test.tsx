import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('exceljs', () => {
  const Workbook = vi.fn().mockImplementation(function () {
    return {
      addWorksheet: vi.fn(() => ({
        addRow: vi.fn(() => ({ height: 0, eachCell: vi.fn() })),
        columns: [],
      })),
      xlsx: { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) },
    };
  });

  return { __esModule: true, Workbook };
});

import * as ExcelJS from 'exceljs';
import Home from '@/src/app/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function fillEnvironments(
  user: UserEvent,
  dev: unknown,
  qa: unknown,
  prod: unknown,
) {
  await user.click(screen.getByLabelText('Dev'));
  await user.paste(JSON.stringify(dev));
  await user.click(screen.getByLabelText('QA'));
  await user.paste(JSON.stringify(qa));
  await user.click(screen.getByLabelText('Prod'));
  await user.paste(JSON.stringify(prod));
}

describe('Home', () => {
  it('shows the three environment inputs and developer footer', () => {
    render(<Home />);

    expect(screen.getByLabelText('Dev')).toBeInTheDocument();
    expect(screen.getByLabelText('QA')).toBeInTheDocument();
    expect(screen.getByLabelText('Prod')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact developer' })).toHaveAttribute(
      'href',
      'https://github.com/arnabnandy7/api-response-comparator',
    );
  });

  it('compares Dev, QA, and Prod in one result table', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { removed: true, value: 1, typed: 1 },
      { added: 'qa', value: 2, typed: '1' },
      { added: 'prod', value: 3, typed: '1' },
    );
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table', { name: 'Differences' });
    expect(within(table).getByRole('columnheader', { name: 'Dev' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'QA' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Prod' })).toBeInTheDocument();
    expect(within(table).getByText('removed')).toBeInTheDocument();
    expect(within(table).getByText('added')).toBeInTheDocument();
    expect(within(table).getByText('value')).toBeInTheDocument();
    expect(within(table).getByText('typed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('API contract changes detected');
  });

  it('compares any two environments when the third is blank', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByLabelText('Dev'));
    await user.paste('{"stable":true,"value":1}');
    await user.click(screen.getByLabelText('QA'));
    await user.paste('{"stable":true,"value":2}');

    const compareButton = screen.getByRole('button', { name: 'Compare' });
    expect(compareButton).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Generate Ignore Rules' }),
    ).toBeEnabled();
    await user.click(compareButton);

    const table = screen.getByRole('table', { name: 'Differences' });
    expect(within(table).getByText('value')).toBeInTheDocument();
    expect(within(table).queryByText('stable')).not.toBeInTheDocument();
    expect(screen.getByText('Show all: 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tree' }));
    expect(
      within(screen.getByRole('region', { name: 'Prod Tree' })).getByText(
        'No JSON provided',
      ),
    ).toBeInTheDocument();
  });

  it('shows separate rows when a path has value and type changes', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { amount: 100 },
      { amount: '100' },
      { amount: 200 },
    );
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const table = screen.getByRole('table', { name: 'Differences' });
    const amountRows = within(table)
      .getAllByText('amount')
      .map((cell) => cell.closest('tr'));

    expect(amountRows).toHaveLength(2);
    expect(amountRows.some((row) => row?.textContent?.includes('TYPE_CHANGE'))).toBe(
      true,
    );
    expect(amountRows.some((row) => row?.textContent?.includes('CHANGED'))).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Changed: 1' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Type changes: 1' }),
    ).toBeInTheDocument();
  });

  it('filters by type and searches paths across three-way results', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { users: [{ name: 'Dev' }], removed: true, typed: 1 },
      { users: [{ name: 'QA' }], added: true, typed: '1' },
      { users: [{ name: 'Prod' }], added: true, typed: '1' },
    );
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    await user.click(screen.getByRole('button', { name: 'Changed: 1' }));
    expect(screen.getByText('users[0].name')).toBeInTheDocument();
    expect(screen.queryByText('typed')).not.toBeInTheDocument();

    const search = screen.getByRole('searchbox', {
      name: 'Search differences by path',
    });
    await user.type(search, 'missing');
    expect(
      screen.getByText('No differences match the selected filter.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all: 4' }));
    await user.clear(search);
    await user.type(search, 'typed');
    expect(screen.getByText('typed')).toBeInTheDocument();
  });

  it('shows color-coded Dev, QA, and Prod trees', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { user: { name: 'Dev', removed: true }, typed: 1 },
      { user: { name: 'QA', added: true }, typed: '1' },
      { user: { name: 'Prod', added: true }, typed: '1' },
    );
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Tree' }));

    expect(screen.getByRole('region', { name: 'Dev Tree' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'QA Tree' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Prod Tree' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dev path user.name CHANGED')).toHaveClass(
      'bg-amber-100',
    );
    expect(screen.getByLabelText('QA path user.added ADDED')).toHaveClass(
      'bg-green-100',
    );
    expect(screen.getByLabelText('Prod path typed TYPE_CHANGE')).toHaveClass(
      'bg-purple-100',
    );
    expect(screen.getByLabelText('Dev path user.removed REMOVED')).toHaveClass(
      'bg-red-100',
    );
  });

  it('keeps copy, Excel, and JSON exports for three-way results', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:api-diff');
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    render(<Home />);

    await fillEnvironments(user, { value: 1 }, { value: 2 }, { value: 3 });
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Download Excel' }));
    await user.click(screen.getByRole('button', { name: 'Download JSON' }));

    expect(ExcelJS.Workbook).toHaveBeenCalled();
    const workbook = (ExcelJS.Workbook as unknown as Mock).mock.results[0].value;
    expect(workbook.xlsx.writeBuffer).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Copy Diff' })).toBeInTheDocument();
  });

  it('fetches and compares three API URLs', async () => {
    const user = userEvent.setup();
    const responses = new Map([
      ['https://dev.test', { value: 1 }],
      ['https://qa.test', { value: 2 }],
      ['https://prod.test', { value: 3 }],
    ]);

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const target = new URL(url, 'http://localhost').searchParams.get('url') ?? '';
      const body = responses.get(target);
      return Promise.resolve({
        ok: Boolean(body),
        status: body ? 200 : 404,
        statusText: body ? 'OK' : 'Not Found',
        text: async () => JSON.stringify(body),
      } as Response);
    }));
    render(<Home />);

    await user.type(screen.getByLabelText('Dev API URL'), 'https://dev.test');
    await user.type(screen.getByLabelText('QA API URL'), 'https://qa.test');
    await user.type(screen.getByLabelText('Prod API URL'), 'https://prod.test');
    await user.type(
      screen.getByLabelText('Dev cURL'),
      "curl 'https://curl-dev.test'",
    );
    await user.type(
      screen.getByLabelText('QA cURL'),
      "curl 'https://curl-qa.test'",
    );
    await user.click(screen.getByRole('button', { name: 'Fetch & Compare' }));

    expect(screen.getByLabelText('Dev')).toHaveValue('{\n  "value": 1\n}');
    expect(screen.getByLabelText('QA')).toHaveValue('{\n  "value": 2\n}');
    expect(screen.getByLabelText('Prod')).toHaveValue('{\n  "value": 3\n}');
    expect(await screen.findByText('value')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(fetch).mock.calls.every(
        ([url, init]) =>
          String(url).startsWith('/api/proxy?url=') && init?.method !== 'POST',
      ),
    ).toBe(true);
  });

  it('fetches and compares two URLs when the third is blank', async () => {
    const user = userEvent.setup();
    const responses = new Map([
      ['https://qa.test', { value: 2 }],
      ['https://prod.test', { value: 3 }],
    ]);

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const target = new URL(url, 'http://localhost').searchParams.get('url') ?? '';
      const body = responses.get(target);
      return Promise.resolve({
        ok: Boolean(body),
        status: body ? 200 : 404,
        statusText: body ? 'OK' : 'Not Found',
        text: async () => JSON.stringify(body),
      } as Response);
    }));
    render(<Home />);

    await user.type(screen.getByLabelText('QA API URL'), 'https://qa.test');
    await user.type(screen.getByLabelText('Prod API URL'), 'https://prod.test');

    const fetchButton = screen.getByRole('button', { name: 'Fetch & Compare' });
    expect(fetchButton).toBeEnabled();
    await user.click(fetchButton);

    expect(screen.getByLabelText('Dev')).toHaveValue('');
    expect(screen.getByLabelText('QA')).toHaveValue('{\n  "value": 2\n}');
    expect(screen.getByLabelText('Prod')).toHaveValue('{\n  "value": 3\n}');
    expect(await screen.findByText('value')).toBeInTheDocument();
  });

  it('imports cURL commands, executes them through the proxy, and compares', async () => {
    const user = userEvent.setup();

    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { url: string };
      const value = request.url.includes('dev') ? 1 : 2;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ value }),
      } as Response);
    }));
    render(<Home />);

    await user.click(screen.getByLabelText('Dev cURL'));
    await user.paste(
      `curl 'https://dev.example.com/data' -H 'authorization: Bearer dev'`,
    );
    await user.click(screen.getByLabelText('QA cURL'));
    await user.paste(
      `curl 'https://qa.example.com/data' -X POST -H 'content-type: application/json' --data-raw '{"query":"test"}'`,
    );
    await user.type(screen.getByLabelText('Dev API URL'), 'https://url-dev.test');
    await user.type(screen.getByLabelText('QA API URL'), 'https://url-qa.test');

    const importButton = screen.getByRole('button', {
      name: 'Import cURL & Compare',
    });
    expect(importButton).toBeEnabled();
    await user.click(importButton);

    expect(screen.getByLabelText('Dev')).toHaveValue('{\n  "value": 1\n}');
    expect(screen.getByLabelText('QA')).toHaveValue('{\n  "value": 2\n}');
    expect(screen.getByLabelText('Prod')).toHaveValue('');
    expect(await screen.findByText('value')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(fetch).mock.calls.every(
        ([url, init]) => url === '/api/proxy' && init?.method === 'POST',
      ),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/proxy',
      expect.objectContaining({ body: expect.stringContaining('"method":"POST"') }),
    );
  });

  it('shows the detailed proxy error when cURL execution fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () =>
          JSON.stringify({
            error:
              'Unable to fetch URL: fetch failed (UND_ERR_CONNECT_TIMEOUT)',
          }),
      } as Response),
    ));
    render(<Home />);

    await user.type(
      screen.getByLabelText('Dev cURL'),
      "curl 'https://dev.example.com/data'",
    );
    await user.type(
      screen.getByLabelText('QA cURL'),
      "curl 'https://qa.example.com/data'",
    );
    await user.click(
      screen.getByRole('button', { name: 'Import cURL & Compare' }),
    );

    expect(
      await screen.findByText(
        /Unable to fetch URL: fetch failed \(UND_ERR_CONNECT_TIMEOUT\)/,
      ),
    ).toBeInTheDocument();
  });

  it('clears each environment URL independently', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText('Dev API URL'), 'https://dev.test');
    await user.type(screen.getByLabelText('QA API URL'), 'https://qa.test');
    await user.type(screen.getByLabelText('Prod API URL'), 'https://prod.test');
    await user.click(screen.getByRole('button', { name: 'Clear QA API URL' }));

    expect(screen.getByLabelText('Dev API URL')).toHaveValue('https://dev.test');
    expect(screen.getByLabelText('QA API URL')).toHaveValue('');
    expect(screen.getByLabelText('Prod API URL')).toHaveValue('https://prod.test');
  });

  it('generates ignore rules from volatility across all environments', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { updatedAt: '2026-06-06T10:00:00Z' },
      { updatedAt: '2026-06-06T10:01:00Z' },
      { updatedAt: '2026-06-06T10:02:00Z' },
    );
    await user.click(screen.getByRole('button', { name: 'Generate Ignore Rules' }));

    expect(screen.getByLabelText('Ignore fields')).toHaveValue('updatedAt');
    expect(screen.getByLabelText('Generated ignore suggestions')).toBeInTheDocument();
  });

  it('clears stale results and ignore rules when any environment changes', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(
      user,
      { updatedAt: '2026-06-06T10:00:00Z' },
      { updatedAt: '2026-06-06T10:01:00Z' },
      { updatedAt: '2026-06-06T10:02:00Z' },
    );
    await user.click(screen.getByRole('button', { name: 'Generate Ignore Rules' }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    await user.type(screen.getByLabelText('Prod'), ' ');

    expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ignore fields')).toHaveValue('');
  });

  it.each([
    ['Dev', 'Invalid JSON in Dev response'],
    ['QA', 'Invalid JSON in QA response'],
    ['Prod', 'Invalid JSON in Prod response'],
  ] as const)('validates the %s response', async (environment, message) => {
    const user = userEvent.setup();
    render(<Home />);

    await fillEnvironments(user, { ok: true }, { ok: true }, { ok: true });
    await user.clear(screen.getByLabelText(environment));
    await user.click(screen.getByLabelText(environment));
    await user.paste('{bad');
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('uploads and clears Prod JSON using the same source-card workflow', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const file = new File(['{"value":3}'], 'prod.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Upload Prod'), file);
    expect(screen.getByLabelText('Prod')).toHaveValue('{"value":3}');
    expect(await screen.findByRole('status')).toHaveTextContent('Loaded prod.json');

    await user.click(screen.getByRole('button', { name: 'Clear Prod' }));
    expect(screen.getByLabelText('Prod')).toHaveValue('');
  });
});
