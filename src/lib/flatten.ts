export type FlattenedJson = Record<string, unknown>;

export function flatten(value: unknown): FlattenedJson {
  const result: FlattenedJson = {};

  visit(value, '', result);

  return result;
}

function visit(value: unknown, path: string, result: FlattenedJson) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      result[path] = value;
      return;
    }

    value.forEach((item, index) => {
      visit(item, `${path}[${index}]`, result);
    });
    return;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      result[path] = value;
      return;
    }

    entries.forEach(([key, childValue]) => {
      const childPath = path ? `${path}.${key}` : key;
      visit(childValue, childPath, result);
    });
    return;
  }

  result[path] = value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
