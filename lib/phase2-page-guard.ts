import { notFound } from 'next/navigation';
import { phase2IntegrationEnabled } from './phase2-integration';

/** The consolidated laboratory has no production rendering path. */
export function requirePhase2IntegrationPage() {
  if (!phase2IntegrationEnabled()) notFound();
}
