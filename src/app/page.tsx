'use client';

import { useState, type ChangeEvent } from 'react';
import { compareJson } from '@/src/lib/compare';
import type { DiffEntry } from '@/src/types/diff';
import { ThemeToggle } from '@/src/components/theme-toggle';

export default function Home() {
  const [jsonA, setJsonA] = useState('');
  const [jsonB, setJsonB] = useState('');
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [error, setError] = useState('');
  const [hasCompared, setHasCompared] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ignoreFields, setIgnoreFields] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const handleCopyDiff = () => {
    const textToCopy = JSON.stringify(diffs, null, 2);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy diff:', err);
    });
  };

  const handleDownloadExcel = async () => {
    const { Workbook } = await import('exceljs');
    const rows = [
      ['Path', 'Type', 'JSON A', 'JSON B'],
      ...diffs.map((diff) => [
        diff.path || '(root)',
        diff.type,
        formatValue(diff.oldValue),
        formatValue(diff.newValue),
      ]),
    ];

      const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Diff');

    // compute column widths similar to previous implementation
    const getCellText = (value: unknown) =>
      value === undefined || value === null ? '' : String(value);

    const cols = rows[0].map((_, colIndex) => {
      const maxChars = rows.reduce((max, row) => {
        const text = getCellText(row[colIndex]);
        return Math.max(
          max,
          ...text.split('\n').map((line) => line.length),
        );
      }, 10);
      return { width: Math.min(maxChars + 4, 60) };
    });

    sheet.columns = cols as any;

    // add header row with styling
    const headerRow = sheet.addRow(rows[0]);
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' },
      } as any;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } as any;
    });

    // add data rows
    for (let i = 1; i < rows.length; i++) {
      const r = sheet.addRow(rows[i]);
      const maxLines = rows[i].reduce((max, value) => {
        const lineCount = getCellText(value).split('\n').length;
        return Math.max(max, lineCount);
      }, 1);
      r.height = Math.max(20, maxLines * 16);
    }

    // write workbook to buffer and trigger download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'api-diff.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  const handleCompare = () => {
    setError('');
    setHasCompared(true);

    const parsedJsonA = parseJson(jsonA);

    if (!parsedJsonA.ok) {
      setDiffs([]);
      setError('Invalid JSON in Response A');
      return;
    }

    const parsedJsonB = parseJson(jsonB);

    if (!parsedJsonB.ok) {
      setDiffs([]);
      setError('Invalid JSON in Response B');
      return;
    }

    const ignoreKeys = ignoreFields
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    setDiffs(compareJson(parsedJsonA.value, parsedJsonB.value, ignoreKeys));
  };

  const handleFormatBoth = () => {
    let hasError = false;
    let newError = '';

    if (jsonA.trim()) {
      try {
        setJsonA(JSON.stringify(JSON.parse(jsonA), null, 2));
      } catch {
        newError += 'Invalid JSON in Response A. ';
        hasError = true;
      }
    }

    if (jsonB.trim()) {
      try {
        setJsonB(JSON.stringify(JSON.parse(jsonB), null, 2));
      } catch {
        newError += 'Invalid JSON in Response B.';
        hasError = true;
      }
    }

    if (hasError) {
      setError(newError.trim());
    } else {
      setError('');
    }
  };

  const handleFetchAndCompare = async () => {
    setError('');
    setIsFetching(true);
    setHasCompared(true);

    try {
      const [respA, respB] = await Promise.all([
        fetch(urlA, { cache: 'no-store' }),
        fetch(urlB, { cache: 'no-store' }),
      ]);

      if (!respA.ok) {
        throw new Error(`Failed to fetch A: ${respA.status} ${respA.statusText}`);
      }
      if (!respB.ok) {
        throw new Error(`Failed to fetch B: ${respB.status} ${respB.statusText}`);
      }

      const [textA, textB] = await Promise.all([respA.text(), respB.text()]);

      // Try to parse to validate JSON; if parse fails, surface error
      let parsedA: unknown;
      let parsedB: unknown;
      try {
        parsedA = JSON.parse(textA);
      } catch (e) {
        throw new Error('Response A is not valid JSON');
      }
      try {
        parsedB = JSON.parse(textB);
      } catch (e) {
        throw new Error('Response B is not valid JSON');
      }

      // update textareas with pretty JSON for inspection
      setJsonA(JSON.stringify(parsedA, null, 2));
      setJsonB(JSON.stringify(parsedB, null, 2));

      const ignoreKeys = ignoreFields
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);

      setDiffs(compareJson(parsedA, parsedB, ignoreKeys));
      showToast('Fetched and compared responses');
    } catch (err: any) {
      console.error(err);
      setDiffs([]);
      setError(err?.message || 'Failed to fetch and compare URLs');
    } finally {
      setIsFetching(false);
    }
  };

  const handleJsonAFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      JSON.parse(fileText);
      setJsonA(fileText);
      setError('');
      showToast(`Loaded ${file.name}`);
    } catch {
      setError('Invalid JSON in uploaded Response A');
    }
  };

  const handleJsonBFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      JSON.parse(fileText);
      setJsonB(fileText);
      setError('');
      showToast(`Loaded ${file.name}`);
    } catch {
      setError('Invalid JSON in uploaded Response B');
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2500);
  };

  const clearJsonA = () => {
    setJsonA('');
  };

  const clearJsonB = () => {
    setJsonB('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            API Response Comparator
          </h1>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {toastMessage && (
          <div className="fixed inset-x-0 top-5 z-50 px-4">
            <div
              className="mx-auto w-full max-w-screen-xl rounded-xl border border-blue-700 bg-blue-600 px-4 py-3 shadow-lg text-sm text-white"
              role="status"
              aria-live="polite"
            >
              {toastMessage}
            </div>
          </div>
        )}
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* JSON A */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-200">
                  📄
                </span>
                <label
                  htmlFor="json-a"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  JSON A
                </label>
              </div>

              <label
                htmlFor="json-a-file"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700"
              >
                <span>Upload JSON A</span>
                <span aria-hidden="true">📁</span>
              </label>

              <input
                id="json-a-file"
                type="file"
                accept=".json,application/json"
                aria-label="Upload JSON A"
                onChange={handleJsonAFileChange}
                className="sr-only"
              />
            </div>

            <div className="relative">
              <textarea
                id="json-a"
                value={jsonA}
                onChange={(e) => setJsonA(e.target.value)}
                placeholder="Paste JSON response here..."
                className="min-h-80 w-full flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
              />
              <button
                type="button"
                onClick={clearJsonA}
                aria-label="Clear JSON A"
                className="absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:bg-zinc-900/90 dark:text-slate-200 dark:hover:bg-zinc-700"
              >
                Clear
              </button>
            </div>
          </div>

          {/* JSON B */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-200">
                  📄
                </span>
                <label
                  htmlFor="json-b"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  JSON B
                </label>
              </div>

              <label
                htmlFor="json-b-file"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700"
              >
                <span>Upload JSON B</span>
                <span aria-hidden="true">📁</span>
              </label>

              <input
                id="json-b-file"
                type="file"
                accept=".json,application/json"
                aria-label="Upload JSON B"
                onChange={handleJsonBFileChange}
                className="sr-only"
              />
            </div>

            <div className="relative">
              <textarea
                id="json-b"
                value={jsonB}
                onChange={(e) => setJsonB(e.target.value)}
                placeholder="Paste JSON response here..."
                className="min-h-80 w-full flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
              />
              <button
                type="button"
                onClick={clearJsonB}
                aria-label="Clear JSON B"
                className="absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:bg-zinc-900/90 dark:text-slate-200 dark:hover:bg-zinc-700"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label
              htmlFor="ignore-fields"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
            >
              Ignore fields
            </label>
            <input
              id="ignore-fields"
              value={ignoreFields}
              onChange={(e) => setIgnoreFields(e.target.value)}
              placeholder="creatUserId, otherField"
              className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        {/* Optional URL fetcher */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              id="url-a"
              value={urlA}
              onChange={(e) => setUrlA(e.target.value)}
              placeholder="API URL A (optional)"
              className="p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <input
              id="url-b"
              value={urlB}
              onChange={(e) => setUrlB(e.target.value)}
              placeholder="API URL B (optional)"
              className="p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={handleFormatBoth}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-800 text-gray-800 dark:text-gray-200 disabled:text-gray-400 dark:disabled:text-zinc-600 font-semibold rounded-lg transition-colors"
            disabled={!jsonA.trim() && !jsonB.trim()}
          >
            Format JSON
          </button>
          <button
            onClick={handleCompare}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
            disabled={!jsonA.trim() || !jsonB.trim()}
          >
            Compare
          </button>
          <button
            onClick={handleFetchAndCompare}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:disabled:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
            disabled={!urlA.trim() || !urlB.trim() || isFetching}
          >
            {isFetching ? 'Fetching…' : 'Fetch & Compare'}
          </button>
        </div>

        {/* Results Section */}
        {(hasCompared || error) && (
          <section>
            <hr className="border-gray-300 dark:border-zinc-700 mb-8" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Results
              </h2>
              {hasCompared && !error && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Diff Counters
                    </span>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 rounded font-medium">
                        Added: {diffs.filter((d) => d.type === 'ADDED').length}
                      </span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 rounded font-medium">
                        Removed: {diffs.filter((d) => d.type === 'REMOVED').length}
                      </span>
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium">
                        Changed: {diffs.filter((d) => d.type === 'CHANGED').length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDiff}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 font-medium rounded transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy Diff'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
                    >
                      Download Excel
                    </button>
                  </div>
                </div>
              )}
            </div>
            {error ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : (
              <DiffTable diffs={diffs} hasCompared={hasCompared} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function DiffTable({
  diffs,
  hasCompared,
}: {
  diffs: DiffEntry[];
  hasCompared: boolean;
}) {
  if (!hasCompared) {
    return (
      <div className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg p-6 min-h-64">
        <p className="text-gray-500 dark:text-gray-400">
          Click &quot;Compare&quot; to see the results here
        </p>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg p-6 min-h-64">
        <p className="text-gray-700 dark:text-gray-300">
          No differences found.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-gray-200">
          <tr>
            <th className="px-4 py-3 font-semibold">Path</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">JSON A</th>
            <th className="px-4 py-3 font-semibold">JSON B</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
          {diffs.map((diff) => (
            <tr key={`${diff.type}-${diff.path}`}>
              <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">
                {diff.path || '(root)'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${getTypeClassName(diff.type)}`}
                >
                  {diff.type}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {formatValue(diff.oldValue)}
              </td>
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {formatValue(diff.newValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'undefined') {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function parseJson(input: string):
  | { ok: true; value: unknown }
  | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(input),
    };
  } catch {
    return { ok: false };
  }
}

function getTypeClassName(type: DiffEntry['type']): string {
  switch (type) {
    case 'ADDED':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    case 'REMOVED':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    case 'CHANGED':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  }
}
