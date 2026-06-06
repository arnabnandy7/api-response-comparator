import { describe, expect, it } from 'vitest';
import {
  generateIgnoreSuggestions,
  getIgnoreFieldFromPath,
  normalizeArrayPath,
} from '@/src/lib/ignore-rules';
import { compareJson } from '@/src/lib/compare';

describe('generateIgnoreSuggestions', () => {
  it('scores volatile field names and values as high confidence', () => {
    expect(
      generateIgnoreSuggestions([
        {
          path: 'user.updatedAt',
          type: 'CHANGED',
          oldValue: '2026-06-06T10:00:00Z',
          newValue: '2026-06-06T10:01:00Z',
        },
        {
          path: 'payment.requestId',
          type: 'CHANGED',
          oldValue: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          newValue: '9b2de3a0-42f5-4c6f-9227-701f2a662c52',
        },
      ]),
    ).toEqual([
      {
        path: 'payment.requestId',
        score: 90,
        confidence: 'High',
        reason: 'field name looks dynamic, value looks like a UUID',
      },
      {
        path: 'user.updatedAt',
        score: 90,
        confidence: 'High',
        reason: 'field name looks dynamic, value looks time-based',
      },
    ]);
  });

  it('combines value and noisy-path scores', () => {
    expect(
      generateIgnoreSuggestions([
        {
          path: 'metadata.marker',
          type: 'CHANGED',
          oldValue: '2026-06-06T10:00:00Z',
          newValue: '2026-06-06T10:05:00Z',
        },
      ]),
    ).toEqual([
      {
        path: 'metadata.marker',
        score: 60,
        confidence: 'Medium',
        reason: 'value looks time-based, path belongs to a noisy metadata area',
      },
    ]);
  });

  it('adds frequency score for repeated array fields', () => {
    const diffs = Array.from({ length: 3 }, (_, index) => ({
      path: `orders[${index}].trackingId`,
      type: 'CHANGED' as const,
      oldValue: `oldtrackingtokenvalue${index}`,
      newValue: `newtrackingtokenvalue${index}`,
    }));

    expect(generateIgnoreSuggestions(diffs)).toEqual([
      {
        path: 'orders[*].trackingId',
        score: 70,
        confidence: 'Medium',
        reason:
          'field name looks like a generated identifier, value looks like a generated token, field changes repeatedly across array items',
      },
    ]);
  });

  it('uses the upper frequency score for 10 or more repeated changes', () => {
    const diffs = Array.from({ length: 10 }, (_, index) => ({
      path: `events[${index}].operationId`,
      type: 'CHANGED' as const,
      oldValue: `oldoperationtokenvalue${index}`,
      newValue: `newoperationtokenvalue${index}`,
    }));

    expect(generateIgnoreSuggestions(diffs)[0]).toMatchObject({
      path: 'events[*].operationId',
      score: 80,
      confidence: 'High',
    });
  });

  it('scores epoch values alongside a volatile name', () => {
    expect(
      generateIgnoreSuggestions([
        {
          path: 'response.timestamp',
          type: 'CHANGED',
          oldValue: 1780760774,
          newValue: 1780760834000,
        },
      ]),
    ).toEqual([
      {
        path: 'response.timestamp',
        score: 85,
        confidence: 'High',
        reason: 'field name looks dynamic, value looks like an epoch timestamp',
      },
    ]);
  });

  it('detects all volatile fields in representative API responses', () => {
    const responseA = {
      requestId: 'REQ-123456',
      traceId: 'TRC-111111',
      timestamp: '2026-06-06T10:15:30Z',
      user: {
        id: 101,
        name: 'Arnab Nandy',
        email: 'arnab@example.com',
        lastLogin: '2026-06-05T22:15:00Z',
      },
      session: {
        sessionId: 'S-987654',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      },
      orders: [
        { orderId: 1001, amount: 500, updatedAt: '2026-06-05T11:00:00Z' },
        { orderId: 1002, amount: 800, updatedAt: '2026-06-05T11:05:00Z' },
      ],
    };
    const responseB = {
      requestId: 'REQ-654321',
      traceId: 'TRC-999999',
      timestamp: '2026-06-06T10:17:45Z',
      user: {
        id: 101,
        name: 'Arnab Nandy',
        email: 'arnab@example.com',
        lastLogin: '2026-06-06T08:05:12Z',
      },
      session: {
        sessionId: 'S-123456',
        token: 'eyJraWQiOiIyMDI2MDYwNiIsInR5cCI6IkpXVCJ9',
      },
      orders: [
        { orderId: 1001, amount: 500, updatedAt: '2026-06-06T08:00:00Z' },
        { orderId: 1002, amount: 800, updatedAt: '2026-06-06T08:05:00Z' },
      ],
    };

    expect(
      generateIgnoreSuggestions(compareJson(responseA, responseB)).map(
        ({ path, confidence }) => ({ path, confidence }),
      ),
    ).toEqual([
      { path: 'orders[*].updatedAt', confidence: 'High' },
      { path: 'timestamp', confidence: 'High' },
      { path: 'requestId', confidence: 'High' },
      { path: 'session.sessionId', confidence: 'High' },
      { path: 'session.token', confidence: 'High' },
      { path: 'traceId', confidence: 'High' },
      { path: 'user.lastLogin', confidence: 'Medium' },
    ]);
  });

  it('only suggests changed fields', () => {
    expect(
      generateIgnoreSuggestions([
        {
          path: 'metadata.createdAt',
          type: 'ADDED',
          newValue: '2026-06-06T10:00:00Z',
        },
        {
          path: 'metadata.traceId',
          type: 'REMOVED',
          oldValue: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        },
      ]),
    ).toEqual([]);
  });

  it('does not suggest ordinary changed business fields below the threshold', () => {
    expect(
      generateIgnoreSuggestions([
        { path: 'user.id', type: 'CHANGED', oldValue: 1, newValue: 2 },
        { path: 'user.format', type: 'CHANGED', oldValue: 'json', newValue: 'xml' },
      ]),
    ).toEqual([]);
  });
});

describe('ignore suggestion path helpers', () => {
  it('normalizes array indices and extracts the leaf field', () => {
    expect(normalizeArrayPath('orders[12].items[0].updatedAt')).toBe(
      'orders[*].items[*].updatedAt',
    );
    expect(getIgnoreFieldFromPath('orders[*].items[*].updatedAt')).toBe('updatedAt');
  });
});
