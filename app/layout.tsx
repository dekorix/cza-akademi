import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://cza-egzersiz-akademisi.habipcann65.chatgpt.site'),
  title: 'CZA Egzersiz Akademisi',
  description:
    'Soroban, Anzan ve bilişsel beceri çalışmalarını kişisel gelişim rotasına dönüştüren CZA öğrenci platformu.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'CZA Egzersiz Akademisi',
    description: 'Soroban, Anzan ve bilişsel beceri çalışmaları için öğrenci ve eğitimci platformu.',
    url: 'https://cza-egzersiz-akademisi.habipcann65.chatgpt.site',
    siteName: 'CZA Egzersiz Akademisi',
    locale: 'tr_TR',
    type: 'website',
    images: [{ url: 'https://cza-egzersiz-akademisi.habipcann65.chatgpt.site/og.png', width: 1731, height: 909, alt: 'CZA Egzersiz Akademisi — Soroban, Anzan ve bilişsel beceri çalışmaları' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CZA Egzersiz Akademisi',
    description: 'Soroban, Anzan ve bilişsel beceri çalışmaları.',
    images: ['https://cza-egzersiz-akademisi.habipcann65.chatgpt.site/og.png'],
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
