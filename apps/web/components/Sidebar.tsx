'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Permission } from '@komuta/shared';
import { brand } from '@komuta/config';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/components/ui';
import {
  IconOverview,
  IconCompanies,
  IconOutlet,
  IconMonitor,
  IconMessages,
  IconMapping,
  IconAccounting,
  IconSettings,
  IconBell,
  IconClose,
  IconReport,
  IconImport,
} from '@/components/icons';

type NavKey =
  | 'overview'
  | 'companies'
  | 'outlets'
  | 'monitor'
  | 'messages'
  | 'mapping'
  | 'accounting'
  | 'settings'
  | 'notifications';

interface NavItem {
  key: NavKey;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Explicit label overrides the i18n catalog (for routes not in `t.nav`). */
  label?: string;
  /** When set, the item only renders if the user holds this permission. */
  perm?: Permission;
}

interface NavSection {
  /** Turkish section label (English in comment). */
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operasyon', // Operations
    items: [
      { key: 'overview', href: '/', icon: IconOverview },
      { key: 'monitor', href: '/monitor', icon: IconMonitor },
      { key: 'messages', href: '/mesajlar', icon: IconMessages },
      { key: 'mapping', href: '/eslestirme', icon: IconMapping },
      { key: 'notifications', href: '/bildirimler', icon: IconBell },
    ],
  },
  {
    label: 'Analiz', // Analytics
    items: [
      { key: 'overview', href: '/raporlar', icon: IconReport, label: 'Raporlar', perm: 'dashboard:read' },
      { key: 'overview', href: '/iceri-aktar', icon: IconImport, label: 'İçeri Aktar', perm: 'revenue:write' },
    ],
  },
  {
    label: 'Yönetim', // Management
    items: [
      { key: 'companies', href: '/firmalar', icon: IconCompanies },
      { key: 'outlets', href: '/sube', icon: IconOutlet },
      { key: 'accounting', href: '/muhasebe', icon: IconAccounting },
      { key: 'settings', href: '/ayarlar', icon: IconSettings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { can } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0f1b3d] text-slate-200 transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent/90 text-base font-bold text-white shadow">
              K
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight text-white">{brand.name}</span>
              <span className="text-[11px] text-slate-400">{brand.tagline}</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Kapat"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-thin">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.perm || can(item.perm));
            if (items.length === 0) return null;
            return (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50',
                        active
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-accent transition-opacity',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon
                        width={19}
                        height={19}
                        className={
                          active ? 'text-brand-accent' : 'text-slate-400 group-hover:text-slate-200'
                        }
                      />
                      {item.label ?? t.nav[item.key]}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-[11px] text-slate-500">
          {brand.name} · {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}
