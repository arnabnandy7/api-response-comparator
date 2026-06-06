// @vitest-environment node

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/src/app/api/proxy/route';

vi.mock('node:net', () => ({
  isIP: (input: string) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) return 4;
    if (/^:/.test(input)) return 6;
    return 0;
  },
}));

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

describe('GET /api/proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ALLOWED_PROXY_HOSTS', 'api.example.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns proxied response text for a valid URL', async () => {
    const { lookup } = await import('node:dns/promises');
    vi.mocked(lookup).mockResolvedValue([
      {
        address: '93.184.216.34',
        family: 4,
      },
    ]);

    const mockFetch = vi.fn(async () => {
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
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  });

  it('returns 400 for direct IP addresses', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://93.184.216.34/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Direct IP addresses are not supported' });
  });

  it('returns 400 for private IP addresses', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://127.0.0.1/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Private and local addresses are not allowed' });
  });

  it('returns 400 for URLs with credentials', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://user:pass@api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'URL credentials are not supported' });
  });

  it('returns 400 for non-HTTPS URLs', async () => {
    const request = new Request('http://localhost/api/proxy?url=http://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Only https URLs are supported' });
  });

  it('returns 400 for a host that is not allowlisted', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const request = new Request('http://localhost/api/proxy?url=https://other.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Target host is not allowed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects an allowlisted host when DNS includes a private address', async () => {
    const { lookup } = await import('node:dns/promises');
    vi.mocked(lookup).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Hostname validation failed: Failed to resolve hostname: Resolved IP is in private range',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 503 when the proxy allowlist is not configured', async () => {
    vi.stubEnv('ALLOWED_PROXY_HOSTS', '');

    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Proxy host allowlist is not configured' });
  });

  it('returns 400 for custom ports', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://api.example.com:8443/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Custom ports are not supported' });
  });

  it('returns 400 when the url parameter is missing', async () => {
    const request = new Request('http://localhost/api/proxy');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing url parameter' });
  });
});
