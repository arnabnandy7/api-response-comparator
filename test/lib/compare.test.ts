import { describe, expect, it } from 'vitest';
import { compareJson } from '@/src/lib/compare';

describe('compareJson', () => {
  it('returns added, removed, and changed diff entries', () => {
    const jsonA = {
      user: {
        name: 'Arnab',
        age: 30,
      },
      roles: ['admin'],
      removed: true,
    };
    const jsonB = {
      user: {
        name: 'Arnab',
        age: 31,
      },
      roles: ['admin', 'owner'],
      added: 'new',
    };

    expect(compareJson(jsonA, jsonB)).toEqual([
      {
        path: 'added',
        type: 'ADDED',
        newValue: 'new',
      },
      {
        path: 'removed',
        type: 'REMOVED',
        oldValue: true,
      },
      {
        path: 'roles[1]',
        type: 'ADDED',
        newValue: 'owner',
      },
      {
        path: 'user.age',
        type: 'CHANGED',
        oldValue: 30,
        newValue: 31,
      },
    ]);
  });

  it('returns an empty array when both JSON values match', () => {
    const value = {
      ok: true,
      data: [{ id: 1 }],
    };

    expect(compareJson(value, value)).toEqual([]);
  });

  it('ignores specified fields when comparing JSON', () => {
    const jsonA = {
      user: {
        creatUserId: 'abc',
        name: 'Arnab',
      },
    };
    const jsonB = {
      user: {
        creatUserId: 'def',
        name: 'Arnab',
      },
    };

    expect(compareJson(jsonA, jsonB, ['creatUserId'])).toEqual([]);
  });
});
