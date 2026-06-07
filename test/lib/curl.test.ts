import { describe, expect, it } from 'vitest';
import { parseCurlCommand } from '@/src/lib/curl';

describe('parseCurlCommand', () => {
  it('parses a multiline JSON POST request', () => {
    expect(
      parseCurlCommand(`curl --location 'https://api.example.com/items' \\
        -X POST \\
        -H 'content-type: application/json' \\
        -H 'authorization: Bearer token' \\
        --data-raw '{"name":"test; still valid"}'`),
    ).toEqual({
      url: 'https://api.example.com/items',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: '{"name":"test; still valid"}',
    });
  });

  it('infers POST when data is provided', () => {
    expect(parseCurlCommand('curl https://api.example.com -d "page=1"')).toEqual({
      url: 'https://api.example.com',
      method: 'POST',
      headers: {},
      body: 'page=1',
    });
  });

  it('converts data to query parameters for --get', () => {
    expect(
      parseCurlCommand("curl --get 'https://api.example.com/items' -d 'page=1'"),
    ).toEqual({
      url: 'https://api.example.com/items?page=1',
      method: 'GET',
      headers: {},
    });
  });

  it('rejects shell execution and file data', () => {
    expect(() =>
      parseCurlCommand('curl https://api.example.com | powershell'),
    ).toThrow('Shell operators are not supported');
    expect(() =>
      parseCurlCommand('curl https://api.example.com --data @payload.json'),
    ).toThrow('File-based cURL data is not supported');
  });
});
