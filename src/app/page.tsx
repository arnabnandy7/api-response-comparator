'use client';

import { useState, type ChangeEvent } from 'react';
import { compareJson } from '@/src/lib/compare';
import {
  generateIgnoreSuggestions,
  getIgnoreFieldFromPath,
  type IgnoreSuggestion,
} from '@/src/lib/ignore-rules';
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
  const [ignoreSuggestions, setIgnoreSuggestions] = useState<IgnoreSuggestion[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  const resetIgnoreRules = () => {
    setIgnoreFields('');
    setIgnoreSuggestions([]);
  };

  const resetSourceDerivedState = () => {
    resetIgnoreRules();
    setDiffs([]);
    setError('');
    setHasCompared(false);
  };

  const handleCopyDiff = () => {
    const textToCopy = JSON.stringify(diffs, null, 2);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy diff:', err);
    });
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(diffs, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, 'api-diff.json');
  };

  const downloadExcel = async (
    rows: unknown[][],
    sheetName: string,
    fileName: string,
  ) => {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(sheetName);

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
      const maxLines = rows[i].reduce<number>((max, value) => {
        const lineCount = getCellText(value).split('\n').length;
        return Math.max(max, lineCount);
      }, 1);
      r.height = Math.max(20, maxLines * 16);
    }

    // write workbook to buffer and trigger download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, fileName);
    });
  };

  const handleDownloadExcel = () => {
    return downloadExcel(
      [
        ['Path', 'Type', 'JSON A', 'JSON B'],
        ...diffs.map((diff) => [
          diff.path || '(root)',
          diff.type,
          formatValue(diff.oldValue),
          formatValue(diff.newValue),
        ]),
      ],
      'Diff',
      'api-diff.xlsx',
    );
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
        const formattedJsonA = JSON.stringify(JSON.parse(jsonA), null, 2);
        if (formattedJsonA !== jsonA) {
          resetSourceDerivedState();
          setJsonA(formattedJsonA);
        }
      } catch {
        newError += 'Invalid JSON in Response A. ';
        hasError = true;
      }
    }

    if (jsonB.trim()) {
      try {
        const formattedJsonB = JSON.stringify(JSON.parse(jsonB), null, 2);
        if (formattedJsonB !== jsonB) {
          resetSourceDerivedState();
          setJsonB(formattedJsonB);
        }
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

  const handleGenerateIgnoreRules = () => {
    setError('');

    const parsedJsonA = parseJson(jsonA);
    if (!parsedJsonA.ok) {
      setIgnoreSuggestions([]);
      setError('Invalid JSON in Response A');
      return;
    }

    const parsedJsonB = parseJson(jsonB);
    if (!parsedJsonB.ok) {
      setIgnoreSuggestions([]);
      setError('Invalid JSON in Response B');
      return;
    }

    const suggestions = generateIgnoreSuggestions(
      compareJson(parsedJsonA.value, parsedJsonB.value),
    );
    setIgnoreSuggestions(suggestions);

    const generatedRules = suggestions
      .map((suggestion) => getIgnoreFieldFromPath(suggestion.path))
      .filter((field): field is string => Boolean(field));

    if (generatedRules.length === 0) {
      showToast('No high-volatility fields detected');
      return;
    }

    const existingRules = ignoreFields
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    const mergedRules = Array.from(new Set([...existingRules, ...generatedRules]));

    setIgnoreFields(mergedRules.join(', '));
    showToast(`Generated ${generatedRules.length} ignore rule${generatedRules.length === 1 ? '' : 's'}`);
  };

  const getProxyUrl = (target: string) =>
    `/api/proxy?url=${encodeURIComponent(target)}`;

  const fetchWithProxy = async (targetUrl: string) => {
    const response = await fetch(getProxyUrl(targetUrl), {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${targetUrl}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  };

  const handleFetchAndCompare = async () => {
    setError('');
    setIsFetching(true);
    setHasCompared(true);

    try {
      const [textA, textB] = await Promise.all([
        fetchWithProxy(urlA),
        fetchWithProxy(urlB),
      ]);

      let parsedA: unknown;
      let parsedB: unknown;

      try {
        parsedA = JSON.parse(textA);
      } catch {
        throw new Error('Response A is not valid JSON');
      }
      try {
        parsedB = JSON.parse(textB);
      } catch {
        throw new Error('Response B is not valid JSON');
      }

      setJsonA(JSON.stringify(parsedA, null, 2));
      setJsonB(JSON.stringify(parsedB, null, 2));
      resetIgnoreRules();
      setDiffs(compareJson(parsedA, parsedB));
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
      resetSourceDerivedState();
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
      resetSourceDerivedState();
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
    resetSourceDerivedState();
    setJsonA('');
  };

  const clearJsonB = () => {
    resetSourceDerivedState();
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
                onChange={(e) => {
                  resetSourceDerivedState();
                  setJsonA(e.target.value);
                }}
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
                onChange={(e) => {
                  resetSourceDerivedState();
                  setJsonB(e.target.value);
                }}
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="ignore-fields"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Ignore fields
              </label>
              <button
                type="button"
                onClick={handleGenerateIgnoreRules}
                disabled={!jsonA.trim() || !jsonB.trim()}
                className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950 dark:disabled:border-zinc-700 dark:disabled:text-zinc-600"
              >
                Generate Ignore Rules
              </button>
            </div>
            <input
              id="ignore-fields"
              value={ignoreFields}
              onChange={(e) => setIgnoreFields(e.target.value)}
              placeholder="creatUserId, otherField"
              className="p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {ignoreSuggestions.length > 0 && (
              <div
                className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40"
                aria-label="Generated ignore suggestions"
              >
                <p className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                  Suggested volatile fields
                </p>
                <ul className="space-y-2">
                  {ignoreSuggestions.map((suggestion) => (
                    <li
                      key={suggestion.path}
                      className="text-slate-700 dark:text-slate-300"
                    >
                      <span className="font-mono font-semibold">{suggestion.path}</span>
                      {' — '}
                      <span>{suggestion.confidence} confidence</span>
                      {` (${suggestion.score}): ${suggestion.reason}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {/* Optional URL fetcher */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <input
                id="url-a"
                aria-label="API URL A"
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="API URL A (optional)"
                className="w-full p-3 pr-16 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {urlA && (
                <button
                  type="button"
                  onClick={() => setUrlA('')}
                  aria-label="Clear API URL A"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200 dark:hover:bg-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="url-b"
                aria-label="API URL B"
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="API URL B (optional)"
                className="w-full p-3 pr-16 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {urlB && (
                <button
                  type="button"
                  onClick={() => setUrlB('')}
                  aria-label="Clear API URL B"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200 dark:hover:bg-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
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
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded font-medium">
                        Type changes: {diffs.filter((d) => d.type === 'TYPE_CHANGE').length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDiff}
                      aria-label="Copy Diff"
                      title={copied ? 'Copied!' : 'Copy Diff'}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                        copied
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {copied ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="14" height="14" x="8" y="8" rx="2" />
                          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      aria-label="Download Excel"
                      title="Download Excel"
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                        <path d="M14 2v6h6" />
                        <path d="m8 13 4 5" />
                        <path d="m12 13-4 5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      aria-label="Download JSON"
                      title="Download JSON"
                      className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                        <path d="M14 2v6h6" />
                        <path d="M9 13c-1 0-1.5.5-1.5 1.5v.5c0 1-.5 1.5-1.5 1.5 1 0 1.5.5 1.5 1.5v.5C7.5 19.5 8 20 9 20" />
                        <path d="M15 13c1 0 1.5.5 1.5 1.5v.5c0 1 .5 1.5 1.5 1.5-1 0-1.5.5-1.5 1.5v.5c0 1-.5 1.5-1.5 1.5" />
                      </svg>
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
              <div className="space-y-4">
                {hasCompared &&
                  diffs.some((diff) =>
                    ['ADDED', 'REMOVED', 'TYPE_CHANGE'].includes(diff.type),
                  ) && (
                    <div
                      role="alert"
                      className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="mt-0.5 h-5 w-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                      <div>
                        <p className="font-semibold">API contract changes detected</p>
                        <p className="mt-1 text-sm">
                          Added, removed, or type-changed fields may require updates
                          in API consumers.
                        </p>
                      </div>
                    </div>
                  )}
                <DiffTable diffs={diffs} hasCompared={hasCompared} />
              </div>
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
      <table
        aria-label="Differences"
        className="w-full min-w-[720px] border-collapse text-left text-sm"
      >
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
    case 'TYPE_CHANGE':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
  }
}
