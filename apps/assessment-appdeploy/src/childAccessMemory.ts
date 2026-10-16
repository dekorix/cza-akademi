const PREFIX = 'cza-child-access:';
const memory = new Map();

type MemoryStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStore(): MemoryStore | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function rememberChildAccess(sessionId: string, token: string, store: MemoryStore | null = browserStore()) {
  if (!sessionId || !token) return;
  memory.set(sessionId, token);
  if (!store) return;
  try { store.setItem(PREFIX + sessionId, token); } catch { /* private mode or quota; the page memory still holds it */ }
}

export function readChildAccess(sessionId: string, store: MemoryStore | null = browserStore()) {
  if (!sessionId) return '';
  if (store) {
    try {
      const saved = store.getItem(PREFIX + sessionId);
      if (saved) return saved;
    } catch { /* fall through to this page's memory */ }
  }
  return memory.get(sessionId) || '';
}

/** Fragment-only child link. The secret is not placed in an HTTP query string. */
export function childAssessmentHash(sessionId: string, token = '') {
  const session = encodeURIComponent(sessionId);
  if (!token) return '#/assessment?session=' + session;
  return '#/assessment?session=' + session + '&access=' + encodeURIComponent(token);
}

/**
 * Reads the capability from the URL fragment, keeps it in sessionStorage, then removes it from the address bar.
 * history.replaceState does not send the fragment to the server.
 */
export function captureChildAccessFromHash(hash: string, store: MemoryStore | null, replace?: (nextHash: string) => void) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, query = ''] = raw.split('?');
  if (!query) return false;
  const params = new URLSearchParams(query);
  const sessionId = params.get('session') || '';
  const token = params.get('access') || '';
  if (!sessionId || !token) return false;
  rememberChildAccess(sessionId, token, store);
  params.delete('access');
  const next = '#' + path + (params.toString() ? '?' + params.toString() : '');
  if (replace && next !== (hash.startsWith('#') ? hash : '#' + hash)) replace(next);
  return true;
}

export function captureChildAccessFromLocation() {
  if (typeof window === 'undefined') return false;
  return captureChildAccessFromHash(window.location.hash, browserStore(), (next) => {
    window.history.replaceState(null, '', next);
  });
}

type HeaderBag = {
  set?: (name: string, value: string) => void;
  Authorization?: string;
};

type RequestConfig = {
  url?: string;
  headers?: HeaderBag;
};

type Client = {
  interceptors?: { request?: { use: (fn: (config: RequestConfig) => RequestConfig) => void } };
  get?: (url: string, ...args: unknown[]) => unknown;
  post?: (url: string, ...args: unknown[]) => unknown;
  put?: (url: string, ...args: unknown[]) => unknown;
};

function sessionIdFromUrl(url: string) {
  const match = /\/api\/session\/([^/?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : '';
}

function applyAuthorization(headers: HeaderBag, token: string) {
  if (typeof headers.set === 'function') headers.set('Authorization', 'Bearer ' + token);
  else headers.Authorization = 'Bearer ' + token;
}

function attach(config: RequestConfig) {
  const sessionId = sessionIdFromUrl(String(config.url || ''));
  const token = sessionId ? readChildAccess(sessionId) : '';
  if (!token) return config;
  const headers = config.headers || {};
  applyAuthorization(headers, token);
  config.headers = headers;
  return config;
}

/** Sends the session capability as Authorization: Bearer on child session calls. */
export function installChildAccessHeader(client: Client) {
  const marked = client as Client & { __czaChildAccess?: boolean };
  if (marked.__czaChildAccess) return;
  marked.__czaChildAccess = true;
  if (client.interceptors?.request?.use) {
    client.interceptors.request.use((config) => attach(config));
    return;
  }
  for (const method of ['get', 'post', 'put'] as const) {
    const original = client[method];
    if (typeof original !== 'function') continue;
    client[method] = (url: string, ...args: unknown[]) => {
      const configIndex = method === 'get' ? 0 : 1;
      const current = args[configIndex];
      const config = current && typeof current === 'object' ? { ...(current as RequestConfig) } : {};
      config.url = url;
      attach(config);
      const rest = { ...config };
      delete rest.url;
      args[configIndex] = rest;
      return original(url, ...args);
    };
  }
}
