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
  return routes;
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
