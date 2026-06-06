import type { DiffEntry } from '@/src/types/diff';
import { flatten } from './flatten';

export type ComparedEnvironments = {
  dev: boolean;
  qa: boolean;
  prod: boolean;
};

export function compareJson(
  devJson: unknown,
  qaJson: unknown,
  prodJson: unknown,
  ignoreFields: string[] = [],
  comparedEnvironments: ComparedEnvironments = {
    dev: true,
    qa: true,
    prod: true,
  },
): DiffEntry[] {
  const environments = [
    {
      key: 'devValue' as const,
      active: comparedEnvironments.dev,
      root: devJson,
      values: comparedEnvironments.dev ? flatten(devJson) : {},
    },
    {
      key: 'qaValue' as const,
      active: comparedEnvironments.qa,
      root: qaJson,
      values: comparedEnvironments.qa ? flatten(qaJson) : {},
    },
    {
      key: 'prodValue' as const,
      active: comparedEnvironments.prod,
      root: prodJson,
      values: comparedEnvironments.prod ? flatten(prodJson) : {},
    },
  ].filter((environment) => environment.active);
  const ignoreKeys = ignoreFields.map((key) => key.trim()).filter(Boolean);

  const paths = Array.from(
    new Set(environments.flatMap((environment) => Object.keys(environment.values))),
  ).sort();

  return paths.reduce<DiffEntry[]>((diffs, path) => {
    if (isIgnoredPath(path, ignoreKeys)) {
      return diffs;
    }

    const values = environments.map((environment) => ({
      ...environment,
      comparable: getComparableValue(
        environment.root,
        environment.values,
        path,
      ),
    }));
    const baseline = values[0].comparable;

    if (
      values.every(
        ({ comparable }) =>
          comparable.found === baseline.found &&
          (!comparable.found || isEqual(comparable.value, baseline.value)),
      )
    ) {
      return diffs;
    }

    let type: DiffEntry['type'];

    if (!baseline.found) {
      type = 'ADDED';
    } else if (values.some(({ comparable }) => !comparable.found)) {
      type = 'REMOVED';
    } else if (
      new Set(
        values.map(({ comparable }) => getJsonType(comparable.value)),
      ).size > 1
    ) {
      type = 'TYPE_CHANGE';
    } else {
      type = 'CHANGED';
    }

    const diff: DiffEntry = { path, type };
    values.forEach(({ key, comparable }) => {
      if (comparable.found) {
        diff[key] = comparable.value;
      }
    });
    diffs.push(diff);

    return diffs;
  }, []);
}

function getComparableValue(
  root: unknown,
  flattened: Record<string, unknown>,
  path: string,
): { found: boolean; value: unknown } {
  if (Object.prototype.hasOwnProperty.call(flattened, path)) {
    return { found: true, value: flattened[path] };
  }

  return getValueAtPath(root, path);
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
