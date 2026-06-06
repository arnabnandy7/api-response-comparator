import { NextResponse } from 'next/server';
import { isIP } from 'net';

const PRIVATE_IPV6_PREFIXES = ['::1', 'fc00', 'fd00', 'fe80'];

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

export async function GET(request: Request) {
  const requestUrl =
    'nextUrl' in request && request.nextUrl
      ? request.nextUrl
      : new URL(request.url);

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

  if (isPrivateIpAddress(target.hostname) || target.hostname === 'localhost') {
    return NextResponse.json(
      { error: 'Private and local addresses are not allowed' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(target.toString(), {
      cache: 'no-store',
      redirect: 'manual',
    });

    const body = await response.text();

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
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown fetch error';
    return NextResponse.json(
      { error: `Unable to fetch URL: ${message}` },
      { status: 502 },
    );
  }
}
