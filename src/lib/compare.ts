import type { DiffEntry } from '@/src/types/diff';
import { flatten } from './flatten';

export function compareJson(jsonA: unknown, jsonB: unknown): DiffEntry[] {
  const valuesA = flatten(jsonA);
  const valuesB = flatten(jsonB);
  const paths = Array.from(
    new Set([...Object.keys(valuesA), ...Object.keys(valuesB)]),
  ).sort();

  return paths.reduce<DiffEntry[]>((diffs, path) => {
    const jsonAHasPath = Object.prototype.hasOwnProperty.call(valuesA, path);
    const jsonBHasPath = Object.prototype.hasOwnProperty.call(valuesB, path);

    if (!jsonAHasPath && jsonBHasPath) {
      diffs.push({
        path,
        type: 'ADDED',
        newValue: valuesB[path],
      });
      return diffs;
    }

    if (jsonAHasPath && !jsonBHasPath) {
      diffs.push({
        path,
        type: 'REMOVED',
        oldValue: valuesA[path],
      });
      return diffs;
    }

    if (!isEqual(valuesA[path], valuesB[path])) {
      diffs.push({
        path,
        type: 'CHANGED',
        oldValue: valuesA[path],
        newValue: valuesB[path],
      });
    }

    return diffs;
  }, []);
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
