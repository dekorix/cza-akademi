import type { Metadata } from 'next';
import { BookPreparationWorkspace } from '@/components/book-preparation-workspace';
import { requireBookPreparationPageIdentity } from '@/lib/book-preparation-page-guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kitap Hazırlama Stüdyosu | CZA',
  description:
    'Eğitimciler için sentetik içerikle çalışan izole kitap ve hızlı okuma metni hazırlama önizlemesi.',
};

export default async function BookPreparationPage() {
  await requireBookPreparationPageIdentity();
  return <BookPreparationWorkspace />;
}
