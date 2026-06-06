import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc00', 'fd00', 'fe80'];
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB

function getAllowedProxyHosts() {
  return (process.env.ALLOWED_PROXY_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

function isPrivateIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4(address);
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return PRIVATE_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  return false;
}

async function validateHostResolution(hostname: string): Promise<void> {
  try {
    const results = await lookup(hostname, { all: true });

    if (results.length === 0) {
      throw new Error('Hostname did not resolve to an IP address');
    }

    if (results.some(({ address }) => isPrivateIpAddress(address))) {
      throw new Error('Resolved IP is in private range');
    }
  } catch (error) {
    throw new Error(
      `Failed to resolve hostname: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const url = requestUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 },
    );
  }

  let target: URL;

  try {
    target = new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 },
    );
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Only https URLs are supported' },
      { status: 400 },
    );
  }

  if (target.username || target.password) {
    return NextResponse.json(
      { error: 'URL credentials are not supported' },
      { status: 400 },
    );
  }

  if (target.port) {
    return NextResponse.json(
      { error: 'Custom ports are not supported' },
      { status: 400 },
    );
  }

  // Reject direct IP addresses to enforce hostname validation
  if (isIP(target.hostname) !== 0) {
    if (isPrivateIpAddress(target.hostname)) {
      return NextResponse.json(
        { error: 'Private and local addresses are not allowed' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Direct IP addresses are not supported' },
      { status: 400 },
    );
  }

  if (target.hostname === 'localhost') {
    return NextResponse.json(
      { error: 'Private and local addresses are not allowed' },
      { status: 400 },
    );
  }

  const normalizedHost = target.hostname.toLowerCase();
  const allowedHost = getAllowedProxyHosts().find((host) => host === normalizedHost);

  if (!allowedHost) {
    return NextResponse.json(
      {
        error: process.env.ALLOWED_PROXY_HOSTS
          ? 'Target host is not allowed'
          : 'Proxy host allowlist is not configured',
      },
      { status: process.env.ALLOWED_PROXY_HOSTS ? 400 : 503 },
    );
  }

  // Validate hostname resolves to a safe IP
  try {
    await validateHostResolution(target.hostname);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Hostname validation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
      { status: 400 },
    );
  }

  // The origin is selected from server configuration; user input only supplies
  // the path and query on that approved HTTPS host.
  const safeTarget = new URL(`https://${allowedHost}`);
  safeTarget.pathname = target.pathname;
  safeTarget.search = target.search;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(safeTarget.toString(), {
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'user-agent': 'api-response-comparator/1.0',
      },
    });

    clearTimeout(timeoutId);

    const body = await response.text();

    if (body.length > MAX_RESPONSE_SIZE) {
      return NextResponse.json(
        { error: 'Response too large' },
        { status: 413 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Remote request failed: ${response.status} ${response.statusText}`, body },
        { status: 502 },
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown fetch error';
    return NextResponse.json(
      { error: `Unable to fetch URL: ${message}` },
      { status: 502 },
    );
  }
}
