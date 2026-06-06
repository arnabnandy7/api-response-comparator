export type JsonSchemaType =
  | 'array'
  | 'boolean'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

export interface SchemaDiffEntry {
  path: string;
  type: 'ADDED' | 'REMOVED' | 'TYPE_CHANGED';
  oldType?: string;
  newType?: string;
}
