import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://celik-zihin-akademisi.habipcann65.chatgpt.site'),
  title: 'Çelik Zihin Akademisi',
  description:
    'Başlangıç değerlendirmesi, çalışma merkezi, öğrenci ve eğitimci ekranları ile özel eğitim ve öğrenme profili akışlarını tek çatı altında birleştiren Çelik Zihin Akademisi platformu.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Çelik Zihin Akademisi',
    description: 'Değerlendirme, öğrenme profili, çalışma merkezi, öğrenci ve eğitimci akışlarını tek çatı altında birleştiren CZA eğitim ekosistemi.',
    url: 'https://celik-zihin-akademisi.habipcann65.chatgpt.site',
    siteName: 'Çelik Zihin Akademisi',
    locale: 'tr_TR',
    type: 'website',
    images: [{ url: 'https://celik-zihin-akademisi.habipcann65.chatgpt.site/og.png', width: 1731, height: 909, alt: 'Çelik Zihin Akademisi — bütünleşik eğitim, değerlendirme ve gelişim platformu' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Çelik Zihin Akademisi',
    description: 'Değerlendirme, öğrenme profili, çalışma merkezi, öğrenci ve eğitimci akışları için bütünleşik CZA platformu.',
    images: ['https://celik-zihin-akademisi.habipcann65.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
