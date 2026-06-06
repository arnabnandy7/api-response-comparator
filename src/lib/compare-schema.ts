import type {
  JsonSchemaType,
  SchemaDiffEntry,
} from '@/src/types/schema-diff';

type SchemaMap = Map<string, Set<JsonSchemaType>>;

export function compareJsonSchemas(
  jsonA: unknown,
  jsonB: unknown,
  ignoreFields: string[] = [],
): SchemaDiffEntry[] {
  const schemaA = buildSchema(jsonA);
  const schemaB = buildSchema(jsonB);
  const ignoreKeys = ignoreFields.map((key) => key.trim()).filter(Boolean);
  const paths = Array.from(new Set([...schemaA.keys(), ...schemaB.keys()])).sort();

  return paths.reduce<SchemaDiffEntry[]>((diffs, path) => {
    if (isIgnoredPath(path, ignoreKeys)) {
      return diffs;
    }

    const typesA = schemaA.get(path);
    const typesB = schemaB.get(path);

    if (!typesA && typesB) {
      diffs.push({
        path,
        type: 'ADDED',
        newType: formatTypes(typesB),
      });
      return diffs;
    }

    if (typesA && !typesB) {
      diffs.push({
        path,
        type: 'REMOVED',
        oldType: formatTypes(typesA),
      });
      return diffs;
    }

    if (typesA && typesB && formatTypes(typesA) !== formatTypes(typesB)) {
      diffs.push({
        path,
        type: 'TYPE_CHANGED',
        oldType: formatTypes(typesA),
        newType: formatTypes(typesB),
      });
    }

    return diffs;
  }, []);
}

function buildSchema(value: unknown): SchemaMap {
  const schema: SchemaMap = new Map();
  visit(value, '', schema);
  return schema;
}

function visit(value: unknown, path: string, schema: SchemaMap) {
  const type = getJsonType(value);
  addType(schema, path, type);

  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, `${path}[*]`, schema));
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      visit(childValue, path ? `${path}.${key}` : key, schema);
    });
  }
}

function addType(schema: SchemaMap, path: string, type: JsonSchemaType) {
  const types = schema.get(path) ?? new Set<JsonSchemaType>();
  types.add(type);
  schema.set(path, types);
}

function getJsonType(value: unknown): JsonSchemaType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

function formatTypes(types: Set<JsonSchemaType>): string {
  return Array.from(types).sort().join(' | ');
}

function isIgnoredPath(path: string, ignoreKeys: string[]): boolean {
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  return segments.some((segment) => ignoreKeys.includes(segment));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
