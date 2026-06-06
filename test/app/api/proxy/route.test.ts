/// <reference types="vitest" />
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/src/app/api/proxy/route';

describe('GET /api/proxy', () => {
  it('returns proxied response text for a valid URL', async () => {
    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ message: 'ok' }),
      } as unknown as Response;
    });

    vi.stubGlobal('fetch', mockFetch);

    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(JSON.stringify({ message: 'ok' }));
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', { cache: 'no-store' });
  });

  it('returns 400 when the url parameter is missing', async () => {
    const request = new Request('http://localhost/api/proxy');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Missing url parameter' });
  });
});
