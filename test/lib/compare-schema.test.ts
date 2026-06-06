import { describe, expect, it } from 'vitest';
import { compareJsonSchemas } from '@/src/lib/compare-schema';

describe('compareJsonSchemas', () => {
  it('reports added, removed, and type-changed fields', () => {
    expect(
      compareJsonSchemas(
        {
          user: { id: 1, active: true, legacy: 'yes' },
        },
        {
          user: { id: '1', active: true, email: 'arnab@example.com' },
        },
      ),
    ).toEqual([
      {
        path: 'user.email',
        type: 'ADDED',
        newType: 'string',
      },
      {
        path: 'user.id',
        type: 'TYPE_CHANGED',
        oldType: 'number',
        newType: 'string',
      },
      {
        path: 'user.legacy',
        type: 'REMOVED',
        oldType: 'string',
      },
    ]);
  });

  it('normalizes array indices so length differences are not schema differences', () => {
    expect(
      compareJsonSchemas(
        { items: [{ id: 1 }] },
        { items: [{ id: 2 }, { id: 3 }] },
      ),
    ).toEqual([]);
  });

  it('reports schema differences inside arrays using wildcard paths', () => {
    expect(
      compareJsonSchemas(
        { items: [{ id: 1, price: 10 }] },
        { items: [{ id: 1, price: '10', currency: 'USD' }] },
      ),
    ).toEqual([
      {
        path: 'items[*].currency',
        type: 'ADDED',
        newType: 'string',
      },
      {
        path: 'items[*].price',
        type: 'TYPE_CHANGED',
        oldType: 'number',
        newType: 'string',
      },
    ]);
  });

  it('supports heterogeneous array element types', () => {
    expect(
      compareJsonSchemas(
        { values: [1, 'two'] },
        { values: [1, true] },
      ),
    ).toEqual([
      {
        path: 'values[*]',
        type: 'TYPE_CHANGED',
        oldType: 'number | string',
        newType: 'boolean | number',
      },
    ]);
  });

  it('respects ignored field names', () => {
    expect(
      compareJsonSchemas(
        { metadata: { requestId: 1 } },
        { metadata: { requestId: 'one' } },
        ['requestId'],
      ),
    ).toEqual([]);
  });
});
