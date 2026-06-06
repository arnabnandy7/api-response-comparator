import type { DiffEntry } from '@/src/types/diff';
import { flatten } from './flatten';

export function compareJson(
  jsonA: unknown,
  jsonB: unknown,
  ignoreFields: string[] = [],
): DiffEntry[] {
  const valuesA = flatten(jsonA);
  const valuesB = flatten(jsonB);
  const ignoreKeys = ignoreFields.map((key) => key.trim()).filter(Boolean);

  const paths = Array.from(
    new Set([...Object.keys(valuesA), ...Object.keys(valuesB)]),
  ).sort();

  return paths.reduce<DiffEntry[]>((diffs, path) => {
    if (isIgnoredPath(path, ignoreKeys)) {
      return diffs;
    }

    const jsonAHasPath = Object.prototype.hasOwnProperty.call(valuesA, path);
    const jsonBHasPath = Object.prototype.hasOwnProperty.call(valuesB, path);

    if (!jsonAHasPath && jsonBHasPath) {
      const originalA = getValueAtPath(jsonA, path);

      if (originalA.found) {
        diffs.push({
          path,
          type: 'CHANGED',
          oldValue: originalA.value,
          newValue: valuesB[path],
        });
        return diffs;
      }

      diffs.push({
        path,
        type: 'ADDED',
        newValue: valuesB[path],
      });
      return diffs;
    }

    if (jsonAHasPath && !jsonBHasPath) {
      const originalB = getValueAtPath(jsonB, path);

      if (originalB.found) {
        diffs.push({
          path,
          type: 'CHANGED',
          oldValue: valuesA[path],
          newValue: originalB.value,
        });
        return diffs;
      }

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
        type:
          getJsonType(valuesA[path]) === getJsonType(valuesB[path])
            ? 'CHANGED'
            : 'TYPE_CHANGE',
        oldValue: valuesA[path],
        newValue: valuesB[path],
      });
    }

    return diffs;
  }, []);
}

function getValueAtPath(root: unknown, path: string): { found: boolean; value: unknown } {
  if (path === '') {
    return { found: true, value: root };
  }

  const segments = path.match(/[^.[\]]+/g);
  if (!segments) {
    return { found: false, value: undefined };
  }

  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) {
        return { found: false, value: undefined };
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return { found: true, value: current };
}

function isIgnoredPath(path: string, ignoreKeys: string[]): boolean {
  if (!ignoreKeys.length) {
    return false;
  }

  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  return segments.some((segment) => ignoreKeys.includes(segment));
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
