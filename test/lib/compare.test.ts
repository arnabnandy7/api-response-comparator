import { describe, expect, it } from 'vitest';
import { compareJson } from '@/src/lib/compare';

describe('compareJson', () => {
  it('returns added, removed, and changed entries across three environments', () => {
    const dev = {
      user: {
        name: 'Arnab',
        age: 30,
      },
      roles: ['admin'],
      removed: true,
    };
    const qa = {
      user: {
        name: 'Arnab',
        age: 31,
      },
      roles: ['admin', 'owner'],
      added: 'new',
    };
    const prod = {
      user: {
        name: 'Arnab',
        age: 32,
      },
      roles: ['admin', 'owner'],
      added: 'new',
    };

    expect(compareJson(dev, qa, prod)).toEqual([
      {
        path: 'added',
        type: 'ADDED',
        qaValue: 'new',
        prodValue: 'new',
      },
      {
        path: 'removed',
        type: 'REMOVED',
        devValue: true,
      },
      {
        path: 'roles[1]',
        type: 'ADDED',
        qaValue: 'owner',
        prodValue: 'owner',
      },
      {
        path: 'user.age',
        type: 'CHANGED',
        devValue: 30,
        qaValue: 31,
        prodValue: 32,
      },
    ]);
  });

  it('returns an empty array when all JSON values match', () => {
    const value = {
      ok: true,
      data: [{ id: 1 }],
    };

    expect(compareJson(value, value, value)).toEqual([]);
  });

  it('returns changed diff for array root when an empty array becomes an array of objects', () => {
    const dev = { x: [] };
    const qa = { x: [{ j: '' }] };
    const prod = { x: [{ j: '' }] };

    expect(compareJson(dev, qa, prod)).toEqual([
      {
        path: 'x',
        type: 'CHANGED',
        devValue: [],
        qaValue: [{ j: '' }],
        prodValue: [{ j: '' }],
      },
      {
        path: 'x[0].j',
        type: 'ADDED',
        qaValue: '',
        prodValue: '',
      },
    ]);
  });

  it('ignores specified fields when comparing JSON', () => {
    const dev = {
      user: {
        creatUserId: 'abc',
        name: 'Arnab',
      },
    };
    const qa = {
      user: {
        creatUserId: 'def',
        name: 'Arnab',
      },
    };

    const prod = {
      user: {
        creatUserId: 'ghi',
        name: 'Arnab',
      },
    };

    expect(compareJson(dev, qa, prod, ['creatUserId'])).toEqual([]);
  });

  it('reports a type change when the same path changes JSON type', () => {
    expect(
      compareJson(
        { user: { id: 101, active: true } },
        { user: { id: '101', active: 'true' } },
        { user: { id: 101, active: 'true' } },
      ),
    ).toEqual([
      {
        path: 'user.active',
        type: 'TYPE_CHANGE',
        devValue: true,
        qaValue: 'true',
        prodValue: 'true',
      },
      {
        path: 'user.id',
        type: 'TYPE_CHANGE',
        devValue: 101,
        qaValue: '101',
        prodValue: 101,
      },
    ]);
  });

  it('reports a change when only Prod differs from Dev and QA', () => {
    expect(
      compareJson(
        { status: 'ready' },
        { status: 'ready' },
        { status: 'deployed' },
      ),
    ).toEqual([
      {
        path: 'status',
        type: 'CHANGED',
        devValue: 'ready',
        qaValue: 'ready',
        prodValue: 'deployed',
      },
    ]);
  });

  it('ignores an inactive Prod environment instead of reporting removals', () => {
    expect(
      compareJson(
        { value: 1, stable: true },
        { value: 2, stable: true },
        undefined,
        [],
        { dev: true, qa: true, prod: false },
      ),
    ).toEqual([
      {
        path: 'value',
        type: 'CHANGED',
        devValue: 1,
        qaValue: 2,
      },
    ]);
  });

  it('uses QA as the baseline when Dev is inactive', () => {
    expect(
      compareJson(
        undefined,
        { retained: true, removed: true },
        { retained: true, added: true },
        [],
        { dev: false, qa: true, prod: true },
      ),
    ).toEqual([
      {
        path: 'added',
        type: 'ADDED',
        prodValue: true,
      },
      {
        path: 'removed',
        type: 'REMOVED',
        qaValue: true,
      },
    ]);
  });
});
