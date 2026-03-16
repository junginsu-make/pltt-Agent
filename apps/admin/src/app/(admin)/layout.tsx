'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/employees', label: '직원 관리', icon: '👥' },
  { href: '/leaves', label: '휴가 관리', icon: '📅' },
  { href: '/approvals', label: '결재 현황', icon: '✅' },
  {
    href: '/settings',
    label: '설정',
    icon: '⚙️',
    children: [
      { href: '/settings/leave-policy', label: '연차 규정', icon: '📋' },
      { href: '/settings/holidays', label: '공휴일', icon: '🎌' },
      { href: '/settings/teams', label: '조직 관리', icon: '🏢' },
    ],
  },
  { href: '/audit-log', label: '감사 로그', icon: '📝' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, loadFromStorage } = useAuthStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const isActive = (href: string) => {
    if (href === '/settings') {
      return pathname.startsWith('/settings');
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-gray-200 flex flex-col" data-testid="sidebar">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary">Palette AI</h1>
          <p className="text-sm text-text-secondary mt-1">관리자</p>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="sidebar-nav">
          {navItems.map((item) => {
            if (item.children) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-secondary hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                    <span className="ml-auto">{settingsOpen ? '▼' : '▶'}</span>
                  </button>
                  {settingsOpen && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                            isActive(child.href)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-text-secondary hover:bg-gray-100'
                          }`}
                        >
                          <span className="mr-3">{child.icon}</span>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-secondary hover:bg-gray-100'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-text-primary">{user?.name || '관리자'}</p>
              <p className="text-text-secondary text-xs">{user?.email || ''}</p>
            </div>
            <button
              onClick={logout}
              className="text-sm text-text-secondary hover:text-error transition-colors"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
