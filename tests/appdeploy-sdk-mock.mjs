export const dbCalls = { update: 0, records: [] };

export const db = {
  async get() {
    return [db.session];
  },
  async update(collection, rows) {
    dbCalls.update += 1;
    dbCalls.records.push({ collection, rows });
    return [true];
  },
  async add() {
    return ['synthetic-id'];
  },
  async list() {
    return { items: [] };
  },
  session: null,
};

export function router(routes) {
  return async function handle(request) {
    const method = request.method || 'GET';
    const path = request.path;
    for (const [key, handlers] of Object.entries(routes)) {
      const space = key.indexOf(' ');
      if (key.slice(0, space) !== method) continue;
      const names = [];
      const regex = new RegExp('^' + key.slice(space + 1).replace(/:([^/]+)/g, (_, name) => {
        names.push(name);
        return '([^/]+)';
      }) + '$');
      const found = path.match(regex);
      if (!found) continue;
      const params = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1])]));
      const ctx = { params, body: request.body, event: { headers: request.headers || {} }, user: undefined };
      for (const fn of handlers) {
        const result = await fn(ctx);
        if (result) return result;
      }
      return { statusCode: 500, headers: {}, body: JSON.stringify({ error: 'empty' }) };
    }
    return { statusCode: 404, headers: {}, body: JSON.stringify({ error: 'no route' }) };
  };
}

export function json(data, status = 200) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
}

export function error(message, status = 400) {
  return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

export const storage = {
  async write() {
    return [true];
  },
};
