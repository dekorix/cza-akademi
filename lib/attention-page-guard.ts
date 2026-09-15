import { notFound } from 'next/navigation';
import {
  assertAttentionConfiguration,
  attentionPreviewEnabled,
} from './attention-session-server';

/** Server-component boundary: the isolated panel never renders fail-open. */
export function requireAttentionPreviewPage() {
  if (!attentionPreviewEnabled()) notFound();
  try {
    assertAttentionConfiguration();
  } catch {
    notFound();
  }
}
