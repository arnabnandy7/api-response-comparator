import { describe, expect, it } from 'vitest';
import { flatten } from '@/src/lib/flatten';

describe('flatten', () => {
  it('flattens nested objects and arrays into path-value pairs', () => {
    expect(
      flatten({
        user: {
          name: 'Arnab',
          roles: ['admin', 'owner'],
          profile: {
            active: true,
            age: null,
          },
        },
        items: [{ id: 1 }, { id: 2 }],
      }),
    ).toEqual({
      'user.name': 'Arnab',
      'user.roles[0]': 'admin',
      'user.roles[1]': 'owner',
      'user.profile.active': true,
      'user.profile.age': null,
      'items[0].id': 1,
      'items[1].id': 2,
    });
  });

  it('preserves empty objects and arrays as leaf values', () => {
    expect(
      flatten({
        emptyObject: {},
        emptyArray: [],
      }),
    ).toEqual({
      emptyObject: {},
      emptyArray: [],
    });
  });
});
