export const ANSWER_STORE_LIMIT = 100000;
export const TRUNCATED_MARK = 'TRUNCATED|';
const MARK = TRUNCATED_MARK;

export function prepareStoredAnswer(raw: string) {
  const text = String(raw || '').trim();
  if (text.length <= ANSWER_STORE_LIMIT) return { text, truncated: false };
  return { text: MARK + text.slice(0, 2000), truncated: true };
}

export function isTruncatedAnswer(answer: string) {
  return String(answer || '').startsWith(MARK);
}
