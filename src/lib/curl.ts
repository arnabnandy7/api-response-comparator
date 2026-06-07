export type CurlRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

const DATA_FLAGS = new Set([
  '-d',
  '--data',
  '--data-raw',
  '--data-binary',
  '--data-ascii',
]);

export function parseCurlCommand(command: string): CurlRequest {
  const tokens = tokenizeCurl(command.trim());

  if (tokens[0]?.toLowerCase() !== 'curl') {
    throw new Error('Command must start with curl');
  }

  let url = '';
  let method = '';
  let useGet = false;
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '-X' || token === '--request') {
      method = readFlagValue(tokens, ++index, token).toUpperCase();
      continue;
    }

    if (token === '-H' || token === '--header') {
      const header = readFlagValue(tokens, ++index, token);
      const separator = header.indexOf(':');
      if (separator <= 0) {
        throw new Error(`Invalid header: ${header}`);
      }
      headers[header.slice(0, separator).trim()] = header.slice(separator + 1).trim();
      continue;
    }

    if (DATA_FLAGS.has(token)) {
      const data = readFlagValue(tokens, ++index, token);
      if (data.startsWith('@')) {
        throw new Error('File-based cURL data is not supported');
      }
      dataParts.push(data);
      continue;
    }

    if (token === '-G' || token === '--get') {
      useGet = true;
      continue;
    }

    if (token === '--url') {
      url = readFlagValue(tokens, ++index, token);
      continue;
    }

    if (token === '-u' || token === '--user') {
      const credentials = readFlagValue(tokens, ++index, token);
      headers.Authorization = `Basic ${encodeBase64(credentials)}`;
      continue;
    }

    if (
      token === '--compressed' ||
      token === '-s' ||
      token === '--silent' ||
      token === '-L' ||
      token === '--location'
    ) {
      continue;
    }

    if (token === '-b' || token === '--cookie') {
      headers.Cookie = readFlagValue(tokens, ++index, token);
      continue;
    }

    if (token === '-A' || token === '--user-agent') {
      headers['User-Agent'] = readFlagValue(tokens, ++index, token);
      continue;
    }

    if (token === '-e' || token === '--referer') {
      headers.Referer = readFlagValue(tokens, ++index, token);
      continue;
    }

    if (token.startsWith('-')) {
      throw new Error(`Unsupported cURL option: ${token}`);
    }

    if (url) {
      throw new Error('cURL command contains more than one URL');
    }
    url = token;
  }

  if (!url) {
    throw new Error('cURL command does not contain a URL');
  }

  let body = dataParts.length > 0 ? dataParts.join('&') : undefined;
  if (useGet && body) {
    const target = new URL(url);
    const separator = target.search ? '&' : '?';
    url = `${target.toString()}${separator}${body}`;
    body = undefined;
  }

  return {
    url,
    method: method || (body ? 'POST' : 'GET'),
    headers,
    ...(body === undefined ? {} : { body }),
  };
}

function readFlagValue(tokens: string[], index: number, flag: string): string {
  const value = tokens[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function tokenizeCurl(command: string): string[] {
  if (!command) {
    throw new Error('cURL command is empty');
  }

  const normalized = command.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];

    if (quote) {
      if (character === quote) {
        quote = undefined;
      } else if (character === '\\' && quote === '"' && index + 1 < normalized.length) {
        current += normalized[++index];
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }

    if (
      character === '|' ||
      character === ';' ||
      character === '<' ||
      character === '>' ||
      character === '`' ||
      (character === '$' && normalized[index + 1] === '(')
    ) {
      throw new Error('Shell operators are not supported');
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    if (character === '\\' && index + 1 < normalized.length) {
      current += normalized[++index];
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error('cURL command contains an unclosed quote');
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function encodeBase64(value: string): string {
  return globalThis.btoa(value);
}
