import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CZA Egzersiz Akademisi',
  description:
    'Soroban, Anzan ve bilişsel beceri çalışmalarını kişisel gelişim rotasına dönüştüren CZA öğrenci platformu.',
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
