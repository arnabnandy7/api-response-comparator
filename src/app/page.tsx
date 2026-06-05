'use client';

import { useState } from 'react';

export default function Home() {
  const [jsonA, setJsonA] = useState('');
  const [jsonB, setJsonB] = useState('');

  const handleCompare = () => {
    // Comparison logic will be added later
    console.log('Comparing:', jsonA, jsonB);
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
            <label className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              JSON A
            </label>
            <textarea
              value={jsonA}
              onChange={(e) => setJsonA(e.target.value)}
              placeholder="Paste JSON response here..."
              className="flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              spellCheck="false"
            />
          </div>

          {/* JSON B */}
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              JSON B
            </label>
            <textarea
              value={jsonB}
              onChange={(e) => setJsonB(e.target.value)}
              placeholder="Paste JSON response here..."
              className="flex-1 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleCompare}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg p-6 min-h-64">
            <p className="text-gray-500 dark:text-gray-400">
              Click "Compare" to see the results here
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}