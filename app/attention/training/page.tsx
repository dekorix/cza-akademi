import type { Metadata } from 'next';
import { AttentionWorkspace } from '@/components/attention-workspace';
import { requireAttentionPreviewPage } from '@/lib/attention-page-guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dikkat ve Odaklanma Laboratuvarı | CZA',
  description:
    'Stroop çelişki yönetimi ve görsel hafıza matrisi için sentetik, izole öğrenci önizlemesi.',
};

export default function AttentionPage() {
  requireAttentionPreviewPage();
  return <AttentionWorkspace />;
}
