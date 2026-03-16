'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/hooks/useSocket';
import ChannelList from '@/components/sidebar/ChannelList';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  // Initialize socket connection (handles auth internally)
  useSocket();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Check storage first - loadFromStorage may not have completed yet
      const token = localStorage.getItem('palette_token');
      if (!token) {
        router.push('/login');
      }
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200 bg-surface">
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <h1 className="text-lg font-bold text-primary">Palette AI</h1>
        </div>
        <ChannelList />
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
