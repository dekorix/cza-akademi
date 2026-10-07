export const NUMERIC_RESPONSE_TYPE = 'numeric' as const;

export type CanonicalResponse = Readonly<{
  type: typeof NUMERIC_RESPONSE_TYPE;
  payload: Readonly<{ value: number }>;
}>;

export function numericResponse(value: number): CanonicalResponse {
  if (!Number.isSafeInteger(value)) throw new Error('invalid_numeric_response');
  return Object.freeze({
    type: NUMERIC_RESPONSE_TYPE,
    payload: Object.freeze({ value }),
  });
}

export function validateCanonicalResponse(
  response: unknown,
): CanonicalResponse {
  if (!response || typeof response !== 'object')
    throw new Error('malformed_generic_response');
  const candidate = response as { type?: unknown; payload?: unknown };
  if (candidate.type !== NUMERIC_RESPONSE_TYPE)
    throw new Error('unsupported_response_type');
  if (!candidate.payload || typeof candidate.payload !== 'object')
    throw new Error('malformed_generic_response');
  const value = (candidate.payload as { value?: unknown }).value;
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new Error('malformed_generic_response');
  return numericResponse(value);
}
