import { describe, expectTypeOf, it } from 'vitest';
import type { DiffEntry } from '@/src/types/diff';

describe('DiffEntry', () => {
  it('represents the supported diff entry shape', () => {
    expectTypeOf<DiffEntry>().toEqualTypeOf<{
      path: string;
      type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'TYPE_CHANGE';
      devValue?: unknown;
      qaValue?: unknown;
      prodValue?: unknown;
    }>();
  });
});
