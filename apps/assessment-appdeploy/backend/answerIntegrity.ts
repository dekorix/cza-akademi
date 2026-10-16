export const ANSWER_BYTE_LIMIT = 16 * 1024;
export const TRUNCATED_MARK = 'TRUNCATED|';

const encoder = new TextEncoder();

export function rawAnswerByteLength(value: string) {
  return encoder.encode(value).byteLength;
}

export function takeRawAnswer<T>(record: T, raw: string): { status: 413; record: T } | { status: 200; record: T; text: string } {
  if (rawAnswerByteLength(raw) > ANSWER_BYTE_LIMIT) return { status: 413, record };
  return { status: 200, record, text: raw.trim() };
}

export function isTruncatedAnswer(answer: string) {
  return String(answer || '').startsWith(TRUNCATED_MARK);
}
