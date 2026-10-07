import type { Metadata } from 'next';
import { FastReadingWorkspace } from '@/components/fast-reading-workspace';

export const metadata: Metadata = {
  title: 'Hızlı Okuma Laboratuvarı | CZA',
  description:
    'Çelik Zihin Akademisi odak, görsel alan ve hızlı okuma egzersizleri önizlemesi.',
};

export default function SpeedReadingPage() {
  return <FastReadingWorkspace />;
}
