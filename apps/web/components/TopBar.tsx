'use client';

import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button, cn } from '@/components/ui';
import { IconMenu, IconLogout } from '@/components/icons';
import type { Locale } from '@komuta/shared';

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Yönetici',
    ACCOUNTANT: 'Muhasebe',
    MANAGER: 'Müdür',
    VIEWER: 'İzleyici',
  };
  return map[role] ?? role;
}

export function TopBar({ onMenu, title }: { onMenu: () => void; title?: string }) {
  const { t, locale, setLocale } = useI18n();
  const { user, logout } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '··';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Menü"
      >
        <IconMenu />
      </button>

      <h1 className="flex-1 truncate text-base font-semibold text-slate-800 sm:text-lg">
        {title ?? t.app.name}
      </h1>

      {/* Language toggle */}
      <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
        {(['tr', 'en'] as Locale[]).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              'rounded-md px-2.5 py-1 uppercase transition-colors',
              locale === l ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {user && (
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {initials}
            </span>
            <div className="leading-tight">
              <p className="max-w-[160px] truncate text-sm font-medium text-slate-700">{user.email}</p>
              <p className="text-xs text-slate-400">{roleLabel(user.role)}</p>
            </div>
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => void logout()} title={t.nav.logout}>
        <IconLogout width={18} height={18} />
        <span className="hidden sm:inline">{t.nav.logout}</span>
      </Button>
    </header>
  );
}
