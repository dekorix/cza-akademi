import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  BOOK_PREPARATION_PREVIEW_COOKIE,
  bookPreparationPreviewEnabled,
  verifyBookPreparationPreviewIdentity,
} from './book-preparation-preview-auth';

export function requireBookPreparationAccessPage() {
  if (!bookPreparationPreviewEnabled()) notFound();
}

/** Server-component boundary: never render the editor before identity checks. */
export async function requireBookPreparationPageIdentity() {
  requireBookPreparationAccessPage();
  const cookieStore = await cookies();
  const identity = verifyBookPreparationPreviewIdentity(
    cookieStore.get(BOOK_PREPARATION_PREVIEW_COOKIE)?.value || '',
  );
  if (!identity) notFound();
  return identity;
}
