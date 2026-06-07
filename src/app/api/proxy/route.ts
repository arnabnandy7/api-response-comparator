import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { Agent, fetch as undiciFetch } from 'undici';

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_REQUEST_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_REDIRECTS = 5;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
const BLOCKED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'proxy-authorization',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
]);

type ProxyRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

const BLOCKED_ADDRESSES = new BlockList();

[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([address, prefix]) => {
  BLOCKED_ADDRESSES.addSubnet(address as string, prefix as number, 'ipv4');
});

[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['2001:db8::', 32],
  ['ff00::', 8],
].forEach(([address, prefix]) => {
  BLOCKED_ADDRESSES.addSubnet(address as string, prefix as number, 'ipv6');
});

function isPublicIpAddress(address: string, family: number) {
  return (
    (family === 4 || family === 6) &&
    !BLOCKED_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6')
  );
}

function validateTarget(target: URL) {
  if (target.protocol !== 'https:') {
    throw new Error('Only https URLs are supported');
  }

  if (target.username || target.password) {
    throw new Error('URL credentials are not supported');
  }

  if (target.port) {
    throw new Error('Custom ports are not supported');
  }

  if (isIP(target.hostname) !== 0 || target.hostname.toLowerCase() === 'localhost') {
    throw new Error('Direct IP and local addresses are not supported');
  }
}

async function resolvePublicAddresses(hostname: string): Promise<LookupAddress[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new Error('Hostname did not resolve to an IP address');
  }

  if (addresses.some(({ address, family }) => !isPublicIpAddress(address, family))) {
    throw new Error('Hostname resolved to a non-public IP address');
  }

  return addresses;
}

function createPublicNetworkAgent() {
  return new Agent({
    connect: {
      lookup(hostname, options, callback) {
        resolvePublicAddresses(hostname)
          .then((addresses) => {
            if (options.all) {
              callback(null, addresses);
              return;
            }

            const address = addresses.find(({ family }) => {
              return options.family === 0 || options.family === family;
            });

            if (!address) {
              callback(new Error(`No public IPv${options.family} address found`), '', 0);
              return;
            }

            callback(null, address.address, address.family);
          })
          .catch((error: unknown) => {
            callback(error instanceof Error ? error : new Error('DNS lookup failed'), '', 0);
          });
      },
    },
  });
}

async function fetchPublicJson(
  target: URL,
  signal: AbortSignal,
  request: Omit<ProxyRequest, 'url'> = {},
) {
  let currentTarget = target;
  const method = (request.method ?? 'GET').toUpperCase();
  const requestHeaders = sanitizeRequestHeaders(request.headers);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    validateTarget(currentTarget);

    const agent = createPublicNetworkAgent();
    try {
      const response = await undiciFetch(currentTarget, {
        dispatcher: agent,
        method,
        headers: {
          'user-agent': 'api-response-comparator/1.0',
          ...requestHeaders,
        },
        ...(method === 'GET' || method === 'HEAD' || request.body === undefined
          ? {}
          : { body: request.body }),
        redirect: 'manual',
        signal,
      });

      if (response.status < 300 || response.status >= 400) {
        return {
          body: await response.text(),
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        };
      }

      const location = response.headers.get('location');
      await response.body?.cancel();

      if (!location) {
        throw new Error('Remote server returned a redirect without a location');
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }

      const nextTarget = new URL(location, currentTarget);
      if (nextTarget.origin !== currentTarget.origin) {
        delete requestHeaders.authorization;
        delete requestHeaders.cookie;
      }
      currentTarget = nextTarget;
    } finally {
      await agent.close();
    }
  }

  throw new Error('Too many redirects');
}

async function proxyRequest(proxyRequest: ProxyRequest) {
  let target: URL;
  try {
    validateProxyRequest(proxyRequest);
    target = new URL(proxyRequest.url);
    validateTarget(target);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid URL' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchPublicJson(target, controller.signal, proxyRequest);

    if (response.body.length > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: 'Response too large' }, { status: 413 });
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Remote request failed: ${response.status} ${response.statusText}`,
          body: response.body,
        },
        { status: 502 },
      );
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    const message = getNetworkErrorMessage(error);
    return NextResponse.json({ error: `Unable to fetch URL: ${message}` }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getNetworkErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown fetch error';
  }

  const cause = error.cause;
  if (cause && typeof cause === 'object') {
    const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : '';
    const message =
      'message' in cause && typeof cause.message === 'string' ? cause.message : '';
    const detail = [code, message].filter(Boolean).join(': ');
    if (detail) {
      return `${error.message} (${detail})`;
    }
  }

  return error.message;
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  return proxyRequest({ url });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid proxy request body' }, { status: 400 });
  }

  if (!isProxyRequest(body)) {
    return NextResponse.json({ error: 'Invalid proxy request body' }, { status: 400 });
  }

  return proxyRequest(body);
}

function validateProxyRequest(request: ProxyRequest) {
  const method = (request.method ?? 'GET').toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`HTTP method ${method} is not supported`);
  }

  if (
    request.body !== undefined &&
    new TextEncoder().encode(request.body).byteLength > MAX_REQUEST_BODY_SIZE
  ) {
    throw new Error('Request body is too large');
  }
}

function sanitizeRequestHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  return Object.entries(headers ?? {}).reduce<Record<string, string>>(
    (safeHeaders, [name, value]) => {
      const normalizedName = name.trim().toLowerCase();
      if (!normalizedName || BLOCKED_REQUEST_HEADERS.has(normalizedName)) {
        return safeHeaders;
      }
      safeHeaders[normalizedName] = value;
      return safeHeaders;
    },
    {},
  );
}

function isProxyRequest(value: unknown): value is ProxyRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Record<string, unknown>;
  const headers = request.headers;

  return (
    typeof request.url === 'string' &&
    (request.method === undefined || typeof request.method === 'string') &&
    (request.body === undefined || typeof request.body === 'string') &&
    (headers === undefined ||
      (typeof headers === 'object' &&
        headers !== null &&
        Object.entries(headers).every(
          ([name, headerValue]) =>
            typeof name === 'string' && typeof headerValue === 'string',
        )))
  );
}
