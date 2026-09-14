import { isIP } from 'node:net';

type CloudflareRequest = Request & { cf?: unknown };

/**
 * In production the client address is accepted only from Cloudflare Workers.
 * request.cf is injected by the runtime and cannot be supplied as an HTTP
 * header by a client hitting this handler directly.
 */
export function trustedRequestAddress(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (environment.NODE_ENV === 'production') {
    const cloudflareContext = (request as CloudflareRequest).cf;
    if (
      environment.CZA_TRUSTED_EDGE !== 'cloudflare' ||
      !cloudflareContext ||
      typeof cloudflareContext !== 'object'
    ) {
      return '';
    }

    const address = (request.headers.get('cf-connecting-ip') || '').trim();
    return isIP(address) ? address : '';
  }

  const forwarded =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for') ||
    'development';
  return forwarded.split(',')[0].trim().slice(0, 80);
}
