import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc00', 'fd00', 'fe80'];
const ALLOWED_PROXY_HOSTS = new Set(
  (process.env.ALLOWED_PROXY_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB

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

async function validateHostResolution(hostname: string): Promise<string> {
  try {
    const result = await lookup(hostname);
    const resolvedIp = result.address;

    if (isPrivateIpAddress(resolvedIp)) {
      throw new Error('Resolved IP is in private range');
    }

    return resolvedIp;
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

  if (!['http:', 'https:'].includes(target.protocol)) {
    return NextResponse.json(
      { error: 'Only http and https URLs are supported' },
      { status: 400 },
    );
  }

  if (target.username || target.password) {
    return NextResponse.json(
      { error: 'URL credentials are not supported' },
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
  if (ALLOWED_PROXY_HOSTS.size > 0 && !ALLOWED_PROXY_HOSTS.has(normalizedHost)) {
    return NextResponse.json(
      { error: 'Target host is not allowed' },
      { status: 400 },
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(target.toString(), {
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
