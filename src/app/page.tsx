'use client';

import { useState } from 'react';
import { compareJson } from '@/src/lib/compare';
import type { DiffEntry } from '@/src/types/diff';

export default function Home() {
  const [jsonA, setJsonA] = useState('');
  const [jsonB, setJsonB] = useState('');
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [error, setError] = useState('');
  const [hasCompared, setHasCompared] = useState(false);

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

    setDiffs(compareJson(parsedJsonA.value, parsedJsonB.value));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            API Response Comparator
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* JSON A */}
          <div className="flex flex-col">
            <label
              htmlFor="json-a"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
            >
              JSON A
            </label>
            <textarea
              id="json-a"
              value={jsonA}
              onChange={(e) => setJsonA(e.target.value)}
              placeholder="Paste JSON response here..."
              className="min-h-80 flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
              spellCheck="false"
            />
          </div>

          {/* JSON B */}
          <div className="flex flex-col">
            <label
              htmlFor="json-b"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
            >
              JSON B
            </label>
            <textarea
              id="json-b"
              value={jsonB}
              onChange={(e) => setJsonB(e.target.value)}
              placeholder="Paste JSON response here..."
              className="min-h-80 flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono text-sm"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleCompare}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
            disabled={!jsonA.trim() || !jsonB.trim()}
          >
            Compare
          </button>
        </div>

        {/* Divider */}
        <hr className="border-gray-300 dark:border-zinc-700 mb-8" />

        {/* Results Section */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Results
          </h2>
          {error ? (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : (
            <DiffTable diffs={diffs} hasCompared={hasCompared} />
          )}
        </section>
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
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                {formatValue(diff.oldValue)}
              </td>
              <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
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

  return JSON.stringify(value);
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
