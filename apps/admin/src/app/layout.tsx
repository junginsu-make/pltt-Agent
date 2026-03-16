import type { Metadata } from 'next';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'Palette AI Admin',
  description: 'Palette AI - 모든 직원에게 AI 비서가 붙은 회사 메신저',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
