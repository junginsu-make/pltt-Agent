import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Palette AI Messenger',
  description: 'Palette AI - 모든 직원에게 AI 비서가 붙은 회사 메신저',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
