// Works with native fetch Response and Puppeteer's HTTPResponse. Never retain
// headers, request bodies, credentials, cookies, tokens or arbitrary error text.
export async function safeAuthResponse(response) {
  const status =
    typeof response.status === 'function' ? response.status() : response.status;
  const data = await response.json().catch(() => ({}));
  return {
    status,
    ok: data?.ok === true,
    error:
      typeof data?.error === 'string' &&
      /^[a-z][a-z0-9_]{0,63}$/.test(data.error)
        ? data.error
        : null,
  };
}
