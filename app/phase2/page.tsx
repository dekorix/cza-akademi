import type { Metadata } from 'next';
import { Phase2Dashboard } from '@/components/phase2-dashboard';
import { requirePhase2IntegrationPage } from '@/lib/phase2-page-guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Faz 2 Laboratuvarı | Çelik Zihin Akademisi',
  description:
    'Hızlı Okuma, Kitap Hazırlama ve Dikkat modüllerinin üretimden bağımsız bütünsel kontrol paneli.',
};

export default function Phase2Page() {
  requirePhase2IntegrationPage();
  return <Phase2Dashboard />;
}
