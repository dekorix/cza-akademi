import { createStagingCoreDatabase } from './database.js';
import {
  parseStagingCoreRequest,
  readBoundedJson,
  StagingCoreRequestError,
} from './request.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function createStudentHandler({ databaseFactory = createStagingCoreDatabase } = {}) {
  return async function studentHandler(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    let input;
    try {
      input = parseStagingCoreRequest(await readBoundedJson(request));
    } catch (error) {
      if (error instanceof StagingCoreRequestError) {
        return json({ ok: false, error: error.code }, error.status);
      }
      return json({ ok: false, error: 'invalid_request' }, 400);
    }

    try {
      const database = databaseFactory();
      const result = await database[input.action](input, request.headers.get('user-agent'));

      if (input.action === 'login') {
        if (!isRecord(result)) return json({ ok: false, error: 'invalid_credentials' }, 401);
        if (result.ok === false) return json(result, 401);
        if (typeof result.sessionToken !== 'string' || !result.sessionToken || result.sessionToken.length > 512) {
          return json({ ok: false, error: 'session_not_created' }, 502);
        }
        return json(result);
      }
      if (input.action === 'me') {
        if (!isRecord(result)) return json({ ok: false, error: 'invalid_session' }, 401);
        return json(result);
      }
      if (input.action === 'start') {
        if (typeof result !== 'string' || !UUID_PATTERN.test(result)) {
          return json({ ok: false, error: 'start_rejected' }, 403);
        }
        return json({ ok: true, sessionId: result });
      }
      if (input.action === 'attempt' || input.action === 'interaction') {
        if (typeof result !== 'string' || !UUID_PATTERN.test(result)) {
          return json({ ok: false, error: 'session_rejected' }, 401);
        }
        return json({ ok: true });
      }
      if (!isRecord(result)) return json({ ok: false, error: 'session_rejected' }, 401);
      return json(result);
    } catch {
      return json({ ok: false, error: 'core_unavailable' }, 503);
    }
  };
}
