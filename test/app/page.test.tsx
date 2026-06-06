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
