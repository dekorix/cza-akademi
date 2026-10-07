import type { Metadata } from 'next';
import { BookPreparationAccess } from '@/components/book-preparation-access';
import { requireBookPreparationAccessPage } from '@/lib/book-preparation-page-guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kitap Hazırlama Erişimi | CZA',
  description: 'İzole CZA Kitap Hazırlama eğitimci kimlik değişimi.',
};

export default function BookPreparationAccessPage() {
  requireBookPreparationAccessPage();
  return <BookPreparationAccess />;
}
