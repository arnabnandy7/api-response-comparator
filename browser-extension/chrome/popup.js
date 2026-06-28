const ENVIRONMENTS = [
  { id: 'dev', label: 'Dev', valueKey: 'devValue' },
  { id: 'qa', label: 'QA', valueKey: 'qaValue' },
  { id: 'prod', label: 'Prod', valueKey: 'prodValue' },
];
const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii']);
const SUGGESTION_THRESHOLD = 60;
const MAX_REQUEST_BODY_SIZE = 1024 * 1024;
const STRONG_VOLATILE_NAME_PATTERNS = [
  /timestamp/i,
  /time/i,
  /date/i,
  /createdAt/i,
  /updatedAt/i,
  /requestId/i,
  /traceId/i,
  /correlationId/i,
  /sessionId/i,
  /token/i,
  /uuid/i,
  /guid/i,
  /nonce/i,
  /etag/i,
  /version/i,
];
const TEMPORAL_NAME_PATTERN = /(?:lastLogin|lastSeen|lastModified|expires|expiry|generated|modified)/i;
const WEAK_IDENTIFIER_NAME_PATTERN = /(?:tracking|transaction|operation|event|message)Id$/i;
const NOISY_PATH_SEGMENTS = new Set(['headers', 'metadata', 'audit', 'debug', 'links']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const EPOCH_PATTERN = /^\d{10,13}$/;
const PREFIXED_IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9]{0,9}-[A-Z0-9]{6,}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9-_]{20,}$/;
const BLOCKED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'proxy-authorization',
  'proxy-connection',
  'referer',
  'transfer-encoding',
  'upgrade',
]);

const state = {
  mode: 'json',
  view: 'table',
  theme: 'light',
  diffs: [],
  filter: 'ALL',
  suggestions: [],
  compared: { dev: undefined, qa: undefined, prod: undefined },
  active: { dev: false, qa: false, prod: false },
  urlController: undefined,
  curlController: undefined,
};

const draftIds = [
  'devJson',
  'qaJson',
  'prodJson',
  'devUrl',
  'qaUrl',
  'prodUrl',
  'devCurl',
  'qaCurl',
  'prodCurl',
  'ignoreFields',
  'pathSearch',
];

const elementIds = [
  ...draftIds,
  'jsonMode',
  'urlMode',
  'curlMode',
  'status',
  'suggestions',
  'diffTable',
  'contractAlert',
  'tableView',
  'treeView',
  'devTree',
  'qaTree',
  'prodTree',
  'countAll',
  'countAdded',
  'countRemoved',
  'countChanged',
  'countType',
  'compareJsonButton',
  'formatButton',
  'fetchButton',
  'curlButton',
  'suggestButton',
  'copyButton',
  'downloadButton',
  'excelButton',
  'resetButton',
  'themeButton',
];

const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

document.addEventListener('DOMContentLoaded', async () => {
  await restoreDraft();
  bindEvents();
  render();
});

function bindEvents() {
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  document.querySelectorAll('.view-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      persistDraft();
      render();
    });
  });

  document.querySelectorAll('.count').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll('[data-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      elements[button.dataset.clear].value = '';
      persistDraft();
      clearSourceDerivedState();
    });
  });

  document.querySelectorAll('.file-input').forEach((input) => {
    input.addEventListener('change', handleFileUpload);
  });

  draftIds.forEach((id) => {
    elements[id].addEventListener('input', () => {
      persistDraft();
      if (id === 'pathSearch') {
        render();
      } else {
        clearSourceDerivedState();
      }
    });
  });

  elements.compareJsonButton.addEventListener('click', compareFromJson);
  elements.formatButton.addEventListener('click', formatJsonInputs);
  elements.fetchButton.addEventListener('click', compareFromUrls);
  elements.curlButton.addEventListener('click', compareFromCurl);
  elements.suggestButton.addEventListener('click', generateSuggestions);
  elements.copyButton.addEventListener('click', copyDiffs);
  elements.downloadButton.addEventListener('click', downloadJson);
  elements.excelButton.addEventListener('click', downloadExcel);
  elements.resetButton.addEventListener('click', resetAll);
  elements.themeButton.addEventListener('click', toggleTheme);
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  elements.jsonMode.classList.toggle('hidden', mode !== 'json');
  elements.urlMode.classList.toggle('hidden', mode !== 'url');
  elements.curlMode.classList.toggle('hidden', mode !== 'curl');
  clearStatus();
  persistDraft();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  persistDraft();
}

function applyTheme() {
  document.body.classList.toggle('theme-dark', state.theme === 'dark');
  elements.themeButton.textContent = state.theme === 'dark' ? '☼' : '◐';
}

async function handleFileUpload(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    JSON.parse(text);
    elements[input.dataset.target].value = text;
    persistDraft();
    clearSourceDerivedState();
    clearStatus();
  } catch {
    showStatus(`${file.name} does not contain valid JSON.`);
  } finally {
    input.value = '';
  }
}

function compareFromJson() {
  const parsed = parseModeJson();
  if (!parsed) return;
  compareParsed(parsed.values, parsed.active, getIgnoreFields());
}

async function compareFromUrls() {
  const urls = getEnvironmentInputValues('Url');
  if (Object.values(urls).filter(Boolean).length < 2) {
    showStatus('Provide at least two HTTPS URLs.');
    return;
  }

  state.urlController?.abort();
  state.urlController = new AbortController();
  setLoading('url', true);

  try {
    const results = await Promise.all(
      ENVIRONMENTS.map(({ id, label }) =>
        fetchOptionalJson(urls[id], label, state.urlController.signal),
      ),
    );
    compareParsed(
      Object.fromEntries(ENVIRONMENTS.map(({ id }, index) => [id, results[index].value])),
      Object.fromEntries(ENVIRONMENTS.map(({ id }, index) => [id, results[index].active])),
      [],
    );
  } catch (error) {
    if (!isAbortError(error)) {
      showStatus(error instanceof Error ? error.message : 'Unable to fetch URLs.');
    }
  } finally {
    setLoading('url', false);
  }
}

async function compareFromCurl() {
  const commands = getEnvironmentInputValues('Curl');
  if (Object.values(commands).filter(Boolean).length < 2) {
    showStatus('Provide at least two cURL commands.');
    return;
  }

  state.curlController?.abort();
  state.curlController = new AbortController();
  setLoading('curl', true);

  try {
    const results = await Promise.all(
      ENVIRONMENTS.map(({ id, label }) =>
        fetchOptionalCurlJson(commands[id], label, state.curlController.signal),
      ),
    );
    compareParsed(
      Object.fromEntries(ENVIRONMENTS.map(({ id }, index) => [id, results[index].value])),
      Object.fromEntries(ENVIRONMENTS.map(({ id }, index) => [id, results[index].active])),
      [],
    );
  } catch (error) {
    if (!isAbortError(error)) {
      showStatus(error instanceof Error ? error.message : 'Unable to import cURL commands.');
    }
  } finally {
    setLoading('curl', false);
  }
}

function compareParsed(values, active, ignoreFields) {
  if (Object.values(active).filter(Boolean).length < 2) {
    showStatus('Provide at least two populated environments.');
    return;
  }

  state.compared = values;
  state.active = active;
  state.diffs = compareJson(values.dev, values.qa, values.prod, ignoreFields, active);
  state.filter = 'ALL';
  state.suggestions = [];
  showStatus(state.diffs.length ? '' : 'No differences found.');
  render();
}

function parseModeJson() {
  const values = {};
  const active = {};
  for (const { id, label } of ENVIRONMENTS) {
    const result = parseOptionalJson(elements[`${id}Json`].value, label);
    if (!result.ok) return undefined;
    values[id] = result.value;
    active[id] = result.active;
  }
  return { values, active };
}

function formatJsonInputs() {
  const updates = [];
  for (const { id, label } of ENVIRONMENTS) {
    const input = elements[`${id}Json`].value.trim();
    if (!input) continue;
    try {
      updates.push([`${id}Json`, JSON.stringify(JSON.parse(input), null, 2)]);
    } catch {
      showStatus(`${label} contains invalid JSON.`);
      return;
    }
  }
  updates.forEach(([id, value]) => {
    elements[id].value = value;
  });
  persistDraft();
  clearSourceDerivedState();
  clearStatus();
}

async function fetchOptionalJson(url, label, signal) {
  if (!url.trim()) return { active: false, value: undefined };
  validateExtensionUrl(url, label);

  const response = await fetch(url, {
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  return parseJsonResponse(response, label);
}

async function fetchOptionalCurlJson(command, label, signal) {
  if (!command.trim()) return { active: false, value: undefined };
  const request = parseCurlCommand(command);
  validateExtensionUrl(request.url, label);
  if (request.body && new TextEncoder().encode(request.body).byteLength > MAX_REQUEST_BODY_SIZE) {
    throw new Error(`${label} cURL request body is too large.`);
  }

  const method = request.method.toUpperCase();
  const response = await fetch(request.url, {
    method,
    headers: sanitizeRequestHeaders(request.headers),
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    credentials: 'omit',
    cache: 'no-store',
    signal,
  });
  return parseJsonResponse(response, label);
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 240)}` : ''}`);
  }
  try {
    return { active: true, value: JSON.parse(text) };
  } catch {
    throw new Error(`${label} did not return valid JSON.`);
  }
}

function validateExtensionUrl(url, label) {
  const target = new URL(url);
  if (target.protocol !== 'https:') {
    throw new Error(`${label} URL must start with https://`);
  }
}

function parseOptionalJson(input, label) {
  if (!input.trim()) return { ok: true, active: false, value: undefined };
  try {
    return { ok: true, active: true, value: JSON.parse(input) };
  } catch {
    showStatus(`${label} contains invalid JSON.`);
    return { ok: false, active: false, value: undefined };
  }
}

function parseCurlCommand(command) {
  const tokens = tokenizeCurl(command.trim());
  if (tokens[0]?.toLowerCase() !== 'curl') throw new Error('Command must start with curl');

  let url = '';
  let method = '';
  let useGet = false;
  const headers = {};
  const dataParts = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-X' || token === '--request') {
      method = readFlagValue(tokens, ++index, token).toUpperCase();
      continue;
    }
    if (token === '-H' || token === '--header') {
      const header = readFlagValue(tokens, ++index, token);
      const separator = header.indexOf(':');
      if (separator <= 0) throw new Error(`Invalid header: ${header}`);
      headers[header.slice(0, separator).trim()] = header.slice(separator + 1).trim();
      continue;
    }
    if (DATA_FLAGS.has(token)) {
      const data = readFlagValue(tokens, ++index, token);
      if (data.startsWith('@')) throw new Error('File-based cURL data is not supported');
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
      headers.Authorization = `Basic ${btoa(readFlagValue(tokens, ++index, token))}`;
      continue;
    }
    if (['--compressed', '-s', '--silent', '-L', '--location'].includes(token)) continue;
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
    if (token.startsWith('-')) throw new Error(`Unsupported cURL option: ${token}`);
    if (url) throw new Error('cURL command contains more than one URL');
    url = token;
  }

  if (!url) throw new Error('cURL command does not contain a URL');
  let body = dataParts.length ? dataParts.join('&') : undefined;
  if (useGet && body) {
    const target = new URL(url);
    target.search += `${target.search ? '&' : ''}${body}`;
    url = target.toString();
    body = undefined;
  }
  return { url, method: method || (body ? 'POST' : 'GET'), headers, ...(body === undefined ? {} : { body }) };
}

function tokenizeCurl(command) {
  if (!command) throw new Error('cURL command is empty');
  const normalized = command.replace(/\\\r?\n/g, ' ');
  const tokens = [];
  let current = '';
  let quote;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quote) {
      if (character === quote) quote = undefined;
      else if (character === '\\' && quote === '"' && index + 1 < normalized.length) current += normalized[++index];
      else current += character;
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

  if (quote) throw new Error('cURL command contains an unclosed quote');
  if (current) tokens.push(current);
  return tokens;
}

function readFlagValue(tokens, index, flag) {
  const value = tokens[index];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

function sanitizeRequestHeaders(headers) {
  return Object.entries(headers ?? {}).reduce((safeHeaders, [name, value]) => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName || BLOCKED_REQUEST_HEADERS.has(normalizedName)) return safeHeaders;
    safeHeaders[normalizedName] = value;
    return safeHeaders;
  }, {});
}

function compareJson(devJson, qaJson, prodJson, ignoreFields, comparedEnvironments) {
  const environments = [
    { key: 'devValue', active: comparedEnvironments.dev, root: devJson, values: comparedEnvironments.dev ? flatten(devJson) : {} },
    { key: 'qaValue', active: comparedEnvironments.qa, root: qaJson, values: comparedEnvironments.qa ? flatten(qaJson) : {} },
    { key: 'prodValue', active: comparedEnvironments.prod, root: prodJson, values: comparedEnvironments.prod ? flatten(prodJson) : {} },
  ].filter((environment) => environment.active);

  const paths = Array.from(new Set(environments.flatMap((environment) => Object.keys(environment.values)))).sort((left, right) =>
    left.localeCompare(right),
  );

  return paths.reduce((diffs, path) => {
    if (isIgnoredPath(path, ignoreFields)) return diffs;
    const values = environments.map((environment) => ({
      ...environment,
      comparable: getComparableValue(environment.root, environment.values, path),
    }));
    const baseline = values[0].comparable;
    const diffsByType = new Map();

    values.slice(1).forEach(({ key, comparable }) => {
      const type = getDiffType(baseline, comparable);
      if (!type) return;
      let diff = diffsByType.get(type);
      if (!diff) {
        diff = { path, type };
        if (baseline.found) diff[values[0].key] = baseline.value;
        diffsByType.set(type, diff);
      }
      if (comparable.found) diff[key] = comparable.value;
    });

    diffs.push(...diffsByType.values());
    return diffs;
  }, []);
}

function flatten(value) {
  const result = {};
  visit(value, '', result);
  return result;
}

function visit(value, path, result) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      result[path] = value;
      return;
    }
    value.forEach((item, index) => visit(item, `${path}[${index}]`, result));
    return;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      result[path] = value;
      return;
    }
    entries.forEach(([key, childValue]) => visit(childValue, path ? `${path}.${key}` : key, result));
    return;
  }
  result[path] = value;
}

function getDiffType(baseline, target) {
  if (!baseline.found && !target.found) return undefined;
  if (!baseline.found) return 'ADDED';
  if (!target.found) return 'REMOVED';
  if (JSON.stringify(baseline.value) === JSON.stringify(target.value)) return undefined;
  if (baseline.value === null || target.value === null) return 'CHANGED';
  return getJsonType(baseline.value) === getJsonType(target.value) ? 'CHANGED' : 'TYPE_CHANGE';
}

function getComparableValue(root, flattened, path) {
  if (Object.prototype.hasOwnProperty.call(flattened, path)) {
    return { found: true, value: flattened[path] };
  }
  return getValueAtPath(root, path);
}

function getValueAtPath(root, path) {
  if (path === '') return { found: true, value: root };
  const segments = path.match(/[^.[\]]+/g);
  if (!segments) return { found: false, value: undefined };
  let current = root;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return { found: false, value: undefined };
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return { found: false, value: undefined };
      current = current[index];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return { found: false, value: undefined };
      current = current[segment];
    }
  }
  return { found: true, value: current };
}

function isIgnoredPath(path, ignoreFields) {
  if (!ignoreFields.length) return false;
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  return segments.some((segment) => ignoreFields.includes(segment));
}

function getJsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function generateSuggestions() {
  if (!state.diffs.length) {
    showStatus('Compare responses before generating ignore rules.');
    return;
  }
  state.suggestions = generateIgnoreSuggestions(state.diffs);
  if (!state.suggestions.length) showStatus('No volatile ignore rules detected.');
  renderSuggestions();
}

function generateIgnoreSuggestions(diffs) {
  const changedDiffs = diffs.filter((diff) => diff.type === 'CHANGED');
  const pathFrequencies = countNormalizedPaths(changedDiffs);
  const suggestions = new Map();

  changedDiffs.forEach((diff) => {
    const normalizedPath = normalizeArrayPath(diff.path);
    const reasons = [];
    let score = 0;
    const nameResult = scoreFieldName(diff.path);
    score += nameResult.score;
    if (nameResult.reason) reasons.push(nameResult.reason);
    const valueResult = scoreValues([diff.devValue, diff.qaValue, diff.prodValue]);
    score += valueResult.score;
    if (valueResult.reason) reasons.push(valueResult.reason);
    if (looksLikeNoisyPath(diff.path)) {
      score += 20;
      reasons.push('path belongs to a noisy metadata area');
    }
    const frequency = pathFrequencies.get(normalizedPath) ?? 0;
    if (frequency >= 10) {
      score += 30;
      reasons.push('field changes repeatedly across 10 or more array items');
    } else if (frequency >= 3) {
      score += 20;
      reasons.push('field changes repeatedly across array items');
    } else if (frequency >= 2) {
      score += 10;
      reasons.push('field changes repeatedly across array items');
    }
    if (score < SUGGESTION_THRESHOLD) return;
    const suggestion = { path: normalizedPath, score, confidence: getConfidence(score), reason: reasons.join(', ') };
    const existing = suggestions.get(normalizedPath);
    if (!existing || suggestion.score > existing.score) suggestions.set(normalizedPath, suggestion);
  });

  return Array.from(suggestions.values()).sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

function countNormalizedPaths(diffs) {
  return Array.from(new Set(diffs.map((diff) => diff.path))).reduce((frequencies, diffPath) => {
    const path = normalizeArrayPath(diffPath);
    frequencies.set(path, (frequencies.get(path) ?? 0) + 1);
    return frequencies;
  }, new Map());
}

function scoreFieldName(path) {
  const leaf = getIgnoreFieldFromPath(path);
  if (!leaf) return { score: 0 };
  if (STRONG_VOLATILE_NAME_PATTERNS.some((pattern) => pattern.test(leaf))) return { score: 50, reason: 'field name looks dynamic' };
  if (TEMPORAL_NAME_PATTERN.test(leaf)) return { score: 25, reason: 'field name looks time-based' };
  if (WEAK_IDENTIFIER_NAME_PATTERN.test(leaf)) return { score: 20, reason: 'field name looks like a generated identifier' };
  return { score: 0 };
}

function scoreValues(values) {
  return values.map(scoreValue).sort((left, right) => right.score - left.score)[0];
}

function scoreValue(value) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string') return { score: 0 };
  if (UUID_PATTERN.test(text)) return { score: 40, reason: 'value looks like a UUID' };
  if (ISO_DATETIME_PATTERN.test(text)) return { score: 40, reason: 'value looks time-based' };
  if (EPOCH_PATTERN.test(text)) return { score: 35, reason: 'value looks like an epoch timestamp' };
  if (PREFIXED_IDENTIFIER_PATTERN.test(text)) return { score: 30, reason: 'value looks like a generated identifier' };
  if (TOKEN_PATTERN.test(text)) return { score: 30, reason: 'value looks like a generated token' };
  return { score: 0 };
}

function normalizeArrayPath(path) {
  return path.replace(/\[\d+\]/g, '[*]');
}

function getIgnoreFieldFromPath(path) {
  const segments = path.match(/[^.[\]]+/g);
  const leaf = segments?.at(-1);
  return leaf && leaf !== '*' && !/^\d+$/.test(leaf) ? leaf : undefined;
}

function looksLikeNoisyPath(path) {
  const segments = path.toLowerCase().split(/[.[\]]+/).filter(Boolean);
  return segments.some((segment) => NOISY_PATH_SEGMENTS.has(segment));
}

function getConfidence(score) {
  if (score >= 80) return 'High';
  if (score >= SUGGESTION_THRESHOLD) return 'Medium';
  return 'Low';
}

function render() {
  updateCounts();
  renderModeAndView();
  renderTable();
  renderTrees();
  renderSuggestions();
  elements.contractAlert.classList.toggle('hidden', !state.diffs.some((diff) => ['ADDED', 'REMOVED', 'TYPE_CHANGE'].includes(diff.type)));
}

function renderModeAndView() {
  document.querySelectorAll('.count').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
  });
  document.querySelectorAll('.view-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.view);
  });
  elements.tableView.classList.toggle('hidden', state.view !== 'table');
  elements.treeView.classList.toggle('hidden', state.view !== 'tree');
}

function renderTable() {
  const visibleDiffs = getVisibleDiffs();
  if (!visibleDiffs.length) {
    elements.diffTable.innerHTML = `<tr><td colspan="5" class="empty">${state.diffs.length ? 'No matching differences.' : 'No comparison yet.'}</td></tr>`;
    return;
  }
  elements.diffTable.innerHTML = visibleDiffs
    .map(
      (diff) => `
        <tr>
          <td>${escapeHtml(diff.path || '(root)')}</td>
          <td><span class="badge ${diff.type}">${escapeHtml(diff.type)}</span></td>
          <td>${escapeHtml(formatValue(diff.devValue))}</td>
          <td>${escapeHtml(formatValue(diff.qaValue))}</td>
          <td>${escapeHtml(formatValue(diff.prodValue))}</td>
        </tr>
      `,
    )
    .join('');
}

function renderTrees() {
  ENVIRONMENTS.forEach(({ id }) => {
    const value = state.active[id] ? state.compared[id] : undefined;
    elements[`${id}Tree`].innerHTML = value === undefined ? '<div class="empty">No active input.</div>' : renderTreeNode(value, id, '', '(root)', true);
  });
}

function renderTreeNode(value, environmentId, path, label, isRoot = false) {
  const diff = selectTreeDiff(path, environmentId);
  const className = diff ? diff.type : '';
  if (Array.isArray(value)) {
    const children = value.length
      ? value.map((item, index) => renderTreeNode(item, environmentId, `${path}[${index}]`, `[${index}]`)).join('')
      : '<div class="tree-node"><div class="tree-line"><span class="tree-value">[]</span></div></div>';
    return `<div class="tree-node ${isRoot ? 'root' : ''} ${className}">
      <div class="tree-line"><span class="tree-key">${escapeHtml(label)}</span><span class="tree-value">Array(${value.length})</span></div>${children}
    </div>`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    const children = entries.length
      ? entries.map(([key, childValue]) => renderTreeNode(childValue, environmentId, path ? `${path}.${key}` : key, key)).join('')
      : '<div class="tree-node"><div class="tree-line"><span class="tree-value">{}</span></div></div>';
    return `<div class="tree-node ${isRoot ? 'root' : ''} ${className}">
      <div class="tree-line"><span class="tree-key">${escapeHtml(label)}</span><span class="tree-value">Object</span></div>${children}
    </div>`;
  }
  return `<div class="tree-node ${isRoot ? 'root' : ''} ${className}">
    <div class="tree-line"><span class="tree-key">${escapeHtml(label)}</span><span class="tree-value">${escapeHtml(formatValue(value))}</span></div>
  </div>`;
}

function selectTreeDiff(path, environmentId) {
  const key = `${environmentId}Value`;
  return state.diffs.find((diff) => diff.path === path && Object.prototype.hasOwnProperty.call(diff, key));
}

function renderSuggestions() {
  elements.suggestions.classList.toggle('hidden', !state.suggestions.length);
  elements.suggestions.innerHTML = state.suggestions
    .map((suggestion) => {
      const leaf = getIgnoreFieldFromPath(suggestion.path) ?? suggestion.path;
      return `<div class="suggestion">
        <div><strong>${escapeHtml(suggestion.path)}</strong><br /><small>${escapeHtml(suggestion.confidence)} · ${suggestion.score} · ${escapeHtml(suggestion.reason)}</small></div>
        <button class="secondary" type="button" data-add-ignore="${escapeHtml(leaf)}">Ignore</button>
      </div>`;
    })
    .join('');
  elements.suggestions.querySelectorAll('[data-add-ignore]').forEach((button) => {
    button.addEventListener('click', () => addIgnoreField(button.dataset.addIgnore));
  });
}

function addIgnoreField(field) {
  const fields = new Set(getIgnoreFields());
  fields.add(field);
  elements.ignoreFields.value = Array.from(fields).join(', ');
  persistDraft();
  showStatus(`Added ${field} to ignored fields. Compare again to apply it.`);
}

function updateCounts() {
  elements.countAll.textContent = String(state.diffs.length);
  elements.countAdded.textContent = String(countType('ADDED'));
  elements.countRemoved.textContent = String(countType('REMOVED'));
  elements.countChanged.textContent = String(countType('CHANGED'));
  elements.countType.textContent = String(countType('TYPE_CHANGE'));
}

function getVisibleDiffs() {
  const query = elements.pathSearch.value.trim().toLowerCase();
  return state.diffs.filter((diff) => {
    const matchesFilter = state.filter === 'ALL' || diff.type === state.filter;
    const matchesSearch = !query || diff.path.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
}

function countType(type) {
  return state.diffs.filter((diff) => diff.type === type).length;
}

function copyDiffs() {
  navigator.clipboard.writeText(JSON.stringify(state.diffs, null, 2));
  showStatus('Copied diff JSON.');
}

function downloadJson() {
  downloadBlob(new Blob([JSON.stringify(state.diffs, null, 2)], { type: 'application/json' }), 'api-diff.json');
}

function downloadExcel() {
  const header = ['Path', 'Type', 'Dev', 'QA', 'Prod'];
  const rows = state.diffs.map((diff) => [diff.path, diff.type, formatValue(diff.devValue), formatValue(diff.qaValue), formatValue(diff.prodValue)]);
  const html = `<html><head><meta charset="utf-8" /></head><body><table>${[header, ...rows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</table></body></html>`;
  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel' }), 'api-diff.xls');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clearSourceDerivedState() {
  state.diffs = [];
  state.suggestions = [];
  state.filter = 'ALL';
  state.compared = { dev: undefined, qa: undefined, prod: undefined };
  state.active = { dev: false, qa: false, prod: false };
  render();
}

function resetAll() {
  state.urlController?.abort();
  state.curlController?.abort();
  draftIds.forEach((id) => {
    elements[id].value = '';
  });
  state.mode = 'json';
  state.view = 'table';
  state.theme = 'light';
  setMode('json');
  applyTheme();
  clearSourceDerivedState();
  clearStatus();
  chrome.storage.local.remove('draft');
}

function setLoading(kind, isLoading) {
  const button = kind === 'url' ? elements.fetchButton : elements.curlButton;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Comparing...' : kind === 'url' ? 'Fetch & Compare' : 'Import cURL & Compare';
}

function getEnvironmentInputValues(suffix) {
  return Object.fromEntries(ENVIRONMENTS.map(({ id }) => [id, elements[`${id}${suffix}`].value.trim()]));
}

function getIgnoreFields() {
  return elements.ignoreFields.value
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
}

function showStatus(message) {
  elements.status.textContent = message;
}

function clearStatus() {
  showStatus('');
}

function formatValue(value) {
  if (value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function persistDraft() {
  const draft = Object.fromEntries(draftIds.map((id) => [id, elements[id].value]));
  draft.mode = state.mode;
  draft.view = state.view;
  draft.theme = state.theme;
  chrome.storage.local.set({ draft });
}

async function restoreDraft() {
  const stored = await chrome.storage.local.get('draft');
  const draft = stored.draft ?? {};
  draftIds.forEach((id) => {
    elements[id].value = draft[id] ?? '';
  });
  state.view = draft.view === 'tree' ? 'tree' : 'table';
  state.theme = draft.theme === 'dark' ? 'dark' : 'light';
  applyTheme();
  setMode(['json', 'url', 'curl'].includes(draft.mode) ? draft.mode : 'json');
}
