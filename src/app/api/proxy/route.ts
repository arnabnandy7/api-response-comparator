import { NextResponse } from 'next/server';

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

  try {
    const response = await fetch(target.toString(), {
      cache: 'no-store',
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
