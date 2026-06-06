import type { DiffEntry } from '@/src/types/diff';

export type IgnoreSuggestion = {
  path: string;
  score: number;
  confidence: 'Low' | 'Medium' | 'High';
  reason: string;
};

const SUGGESTION_THRESHOLD = 60;
const STRONG_VOLATILE_NAME_PATTERNS = [
  /timestamp/i,
  /time/i,
  /date/i,
  /createdAt/i,
  /updatedAt/i,
  /requestId/i,
  /traceId/i,
  /correlationId/i,
  /sessionId/i,
  /token/i,
  /uuid/i,
  /guid/i,
  /nonce/i,
  /etag/i,
  /version/i,
];
const TEMPORAL_NAME_PATTERN =
  /(?:lastLogin|lastSeen|lastModified|expires|expiry|generated|modified)/i;
const WEAK_IDENTIFIER_NAME_PATTERN = /(?:tracking|transaction|operation|event|message)Id$/i;
const NOISY_PATH_SEGMENTS = new Set(['headers', 'metadata', 'audit', 'debug', 'links']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const EPOCH_PATTERN = /^\d{10,13}$/;
const PREFIXED_IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9]{0,9}-[A-Z0-9]{6,}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9-_]{20,}$/;

export function generateIgnoreSuggestions(diffs: DiffEntry[]): IgnoreSuggestion[] {
  const changedDiffs = diffs.filter((diff) => diff.type === 'CHANGED');
  const pathFrequencies = countNormalizedPaths(changedDiffs);
  const suggestions = new Map<string, IgnoreSuggestion>();

  changedDiffs.forEach((diff) => {
    const normalizedPath = normalizeArrayPath(diff.path);
    const reasons: string[] = [];
    let score = 0;

    const nameResult = scoreFieldName(diff.path);
    score += nameResult.score;
    if (nameResult.reason) reasons.push(nameResult.reason);

    const valueResult = scoreValues(diff.oldValue, diff.newValue);
    score += valueResult.score;
    if (valueResult.reason) reasons.push(valueResult.reason);

    if (looksLikeNoisyPath(diff.path)) {
      score += 20;
      reasons.push('path belongs to a noisy metadata area');
    }

    const frequency = pathFrequencies.get(normalizedPath) ?? 0;
    if (frequency >= 10) {
      score += 30;
      reasons.push('field changes repeatedly across 10 or more array items');
    } else if (frequency >= 3) {
      score += 20;
      reasons.push('field changes repeatedly across array items');
    } else if (frequency >= 2) {
      score += 10;
      reasons.push('field changes repeatedly across array items');
    }

    if (score < SUGGESTION_THRESHOLD) {
      return;
    }

    const suggestion = {
      path: normalizedPath,
      score,
      confidence: getConfidence(score),
      reason: reasons.join(', '),
    } satisfies IgnoreSuggestion;
    const existing = suggestions.get(normalizedPath);

    if (!existing || suggestion.score > existing.score) {
      suggestions.set(normalizedPath, suggestion);
    }
  });

  return Array.from(suggestions.values()).sort(
    (left, right) => right.score - left.score || left.path.localeCompare(right.path),
  );
}

export function normalizeArrayPath(path: string): string {
  return path.replace(/\[\d+\]/g, '[*]');
}

export function getIgnoreFieldFromPath(path: string): string | undefined {
  const segments = path.match(/[^.[\]]+/g);
  const leaf = segments?.at(-1);

  return leaf && leaf !== '*' && !/^\d+$/.test(leaf) ? leaf : undefined;
}

function countNormalizedPaths(diffs: DiffEntry[]): Map<string, number> {
  return diffs.reduce((frequencies, diff) => {
    const path = normalizeArrayPath(diff.path);
    frequencies.set(path, (frequencies.get(path) ?? 0) + 1);
    return frequencies;
  }, new Map<string, number>());
}

function scoreFieldName(path: string): { score: number; reason?: string } {
  const leaf = getIgnoreFieldFromPath(path);
  if (!leaf) {
    return { score: 0 };
  }

  if (STRONG_VOLATILE_NAME_PATTERNS.some((pattern) => pattern.test(leaf))) {
    return { score: 50, reason: 'field name looks dynamic' };
  }

  if (TEMPORAL_NAME_PATTERN.test(leaf)) {
    return { score: 25, reason: 'field name looks time-based' };
  }

  if (WEAK_IDENTIFIER_NAME_PATTERN.test(leaf)) {
    return { score: 20, reason: 'field name looks like a generated identifier' };
  }

  return { score: 0 };
}

function scoreValues(oldValue: unknown, newValue: unknown): { score: number; reason?: string } {
  const results = [oldValue, newValue].map(scoreValue);
  return results.sort((left, right) => right.score - left.score)[0];
}

function scoreValue(value: unknown): { score: number; reason?: string } {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string') {
    return { score: 0 };
  }

  if (UUID_PATTERN.test(text)) {
    return { score: 40, reason: 'value looks like a UUID' };
  }

  if (ISO_DATETIME_PATTERN.test(text)) {
    return { score: 40, reason: 'value looks time-based' };
  }

  if (EPOCH_PATTERN.test(text)) {
    return { score: 35, reason: 'value looks like an epoch timestamp' };
  }

  if (PREFIXED_IDENTIFIER_PATTERN.test(text)) {
    return { score: 30, reason: 'value looks like a generated identifier' };
  }

  if (TOKEN_PATTERN.test(text)) {
    return { score: 30, reason: 'value looks like a generated token' };
  }

  return { score: 0 };
}

function looksLikeNoisyPath(path: string): boolean {
  const segments = path.toLowerCase().split(/[.[\]]+/).filter(Boolean);
  return segments.some((segment) => NOISY_PATH_SEGMENTS.has(segment));
}

function getConfidence(score: number): IgnoreSuggestion['confidence'] {
  if (score >= 80) {
    return 'High';
  }

  if (score >= SUGGESTION_THRESHOLD) {
    return 'Medium';
  }

  return 'Low';
}
