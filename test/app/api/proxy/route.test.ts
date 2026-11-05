// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/src/app/api/proxy/route';

const { mockFetch, mockAgentClose } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockAgentClose: vi.fn(async () => undefined),
}));

vi.mock('undici', () => ({
  Agent: vi.fn(function MockAgent() {
    return { close: mockAgentClose };
  }),
  fetch: mockFetch,
}));

describe('GET /api/proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        statusText: 'OK',
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns proxied response text for an arbitrary HTTPS hostname', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(JSON.stringify({ message: 'ok' }));
    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://api.example.com/data'),
      expect.objectContaining({
        redirect: 'manual',
        dispatcher: expect.any(Object),
      }),
    );
  });

  it('validates and follows redirects one hop at a time', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://other.example.com/result' },
        }),
      )
      .mockResolvedValueOnce(new Response('{"redirected":true}', { status: 200 }));

    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"redirected":true}');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      new URL('https://other.example.com/result'),
      expect.any(Object),
    );
  });

  it('decodes UTF-8 characters split across response chunks', async () => {
    const bytes = new TextEncoder().encode('{"message":"€😀"}');
    let offset = 0;
    mockFetch.mockResolvedValueOnce(new Response(new ReadableStream({
      pull(controller) {
        if (offset === bytes.length) {
          controller.close();
        } else {
          controller.enqueue(bytes.subarray(offset, ++offset));
        }
      },
    })));

    const response = await GET(new Request('http://localhost/api/proxy?url=https://api.example.com/data'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"message":"€😀"}');
  });

  it('accepts a response exactly at the 50 MB limit', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(120);
    let chunksRead = 0;
    mockFetch.mockResolvedValueOnce(new Response(new ReadableStream({
      pull(controller) {
        if (chunksRead++ === 50) controller.close();
        else controller.enqueue(chunk);
      },
    })));

    const response = await GET(new Request('http://localhost/api/proxy?url=https://api.example.com/data'));

    expect(response.status).toBe(200);
    expect((await response.text()).length).toBe(50 * 1024 * 1024);
  });

  it.each([200, 503])('cancels an oversized %i response by bytes before reading the rest', async (status) => {
    // Each chunk has 1 MB of characters but 2 MB of UTF-8 bytes.
    const chunk = new TextEncoder().encode('é'.repeat(1024 * 1024));
    const cancel = vi.fn();
    let chunksRead = 0;
    const upstream = new Response(new ReadableStream({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(chunk);
      },
      cancel,
    }, { highWaterMark: 0 }), {
      status,
      // The limit must work even when Content-Length is inaccurate.
      headers: { 'content-length': '1' },
    });
    mockFetch.mockResolvedValueOnce(upstream);

    const response = await POST(new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://api.example.com/data' }),
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Response too large' });
    expect(chunksRead).toBe(26);
    expect(cancel).toHaveBeenCalledOnce();
    expect(upstream.body?.locked).toBe(false);
    expect(mockAgentClose).toHaveBeenCalledOnce();
  });

  it('handles an empty upstream body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null));

    const response = await GET(new Request('http://localhost/api/proxy?url=https://api.example.com/data'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('returns 400 for direct IP addresses', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://93.184.216.34/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Direct IP and local addresses are not supported',
    });
  });

  it('returns 400 for private IP addresses', async () => {
    const request = new Request('http://localhost/api/proxy?url=https://127.0.0.1/data');
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Direct IP and local addresses are not supported',
    });
  });

  it('returns 400 for URLs with credentials', async () => {
    const request = new Request(
      'http://localhost/api/proxy?url=https://user:pass@api.example.com/data',
    );
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

  it('forwards a structured cURL request method, headers, and body', async () => {
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/items',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
          host: 'malicious.example.com',
        },
        body: '{"name":"test"}',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      new URL('https://api.example.com/items'),
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"test"}',
        headers: {
          'user-agent': 'api-response-comparator/1.0',
          'content-type': 'application/json',
          authorization: 'Bearer token',
        },
      }),
    );
  });

  it('rejects unsupported methods in structured proxy requests', async () => {
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/items',
        method: 'CONNECT',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'HTTP method CONNECT is not supported',
    });
  });

  it('returns 400 for invalid structured proxy request JSON', async () => {
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid proxy request body' });
  });

  it('returns 400 for malformed structured proxy requests', async () => {
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/items',
        headers: {
          accept: 42,
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid proxy request body' });
  });

  it('rejects oversized structured request bodies before fetching', async () => {
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/items',
        method: 'POST',
        body: 'x'.repeat(1024 * 1024 + 1),
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Request body is too large' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 502 with response body when the remote server fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"upstream"}', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');

    const response = await GET(request);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Remote request failed: 503 Service Unavailable',
      body: '{"error":"upstream"}',
    });
  });

  it('returns 502 when a redirect is missing its location header', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 302 }));
    const request = new Request('http://localhost/api/proxy?url=https://api.example.com/data');

    const response = await GET(request);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Unable to fetch URL: Remote server returned a redirect without a location',
    });
  });

  it('returns the underlying network error code for failed requests', async () => {
    mockFetch.mockRejectedValueOnce(
      new Error('fetch failed', {
        cause: {
          code: 'UND_ERR_CONNECT_TIMEOUT',
          message: 'Connect Timeout Error',
        },
      }),
    );
    const request = new Request('http://localhost/api/proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/items',
        method: 'GET',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error:
        'Unable to fetch URL: fetch failed (UND_ERR_CONNECT_TIMEOUT: Connect Timeout Error)',
    });
  });
});
