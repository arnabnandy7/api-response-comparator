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

  it('parses request aliases, cookies, user agents, referers, and basic auth', () => {
    expect(
      parseCurlCommand(
        'curl --url https://api.example.com/items --request patch --user user:pass --cookie sid=123 --user-agent Comparator --referer https://app.example.com --compressed --silent',
      ),
    ).toEqual({
      url: 'https://api.example.com/items',
      method: 'PATCH',
      headers: {
        Authorization: 'Basic dXNlcjpwYXNz',
        Cookie: 'sid=123',
        'User-Agent': 'Comparator',
        Referer: 'https://app.example.com',
      },
    });
  });

  it('joins multiple data flags and preserves escaped double-quoted content', () => {
    expect(
      parseCurlCommand(
        'curl "https://api.example.com/items" --data "name=Arnab" --data-ascii "note=hello \\"world\\""',
      ),
    ).toEqual({
      url: 'https://api.example.com/items',
      method: 'POST',
      headers: {},
      body: 'name=Arnab&note=hello "world"',
    });
  });

  it('rejects malformed cURL commands', () => {
    expect(() => parseCurlCommand('')).toThrow('cURL command is empty');
    expect(() => parseCurlCommand('wget https://api.example.com')).toThrow(
      'Command must start with curl',
    );
    expect(() => parseCurlCommand('curl -H')).toThrow('-H requires a value');
    expect(() => parseCurlCommand("curl 'https://api.example.com")).toThrow(
      'cURL command contains an unclosed quote',
    );
    expect(() => parseCurlCommand('curl https://api.example.com --retry 3')).toThrow(
      'Unsupported cURL option: --retry',
    );
    expect(() =>
      parseCurlCommand('curl https://api.example.com https://api2.example.com'),
    ).toThrow('cURL command contains more than one URL');
    expect(() => parseCurlCommand('curl -H missing https://api.example.com')).toThrow(
      'Invalid header: missing',
    );
    expect(() => parseCurlCommand('curl -H "accept: application/json"')).toThrow(
      'cURL command does not contain a URL',
    );
  });
});
