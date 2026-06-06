import { expectTypeOf, test } from 'vitest';
import type { SchemaDiffEntry } from '@/src/types/schema-diff';

test('SchemaDiffEntry exposes schema change details', () => {
  expectTypeOf<SchemaDiffEntry>().toMatchTypeOf<{
    path: string;
    type: 'ADDED' | 'REMOVED' | 'TYPE_CHANGED';
    oldType?: string;
    newType?: string;
  }>();
});
