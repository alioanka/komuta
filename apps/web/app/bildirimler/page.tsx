'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationEvent } from '@komuta/shared';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import {
  IconAlert,
  IconBell,
  IconClock,
  IconDoubleCheck,
  IconMapping,
  IconMessages,
  IconSummary,
  IconTrendUp,
} from '@/components/icons';
import { formatRelative } from '@/lib/format';
import { notificationEventLabel } from '@/lib/labels';
import type { NotificationItem } from '@/lib/types';

const eventStyle: Record<
  NotificationEvent,
  { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; chip: string }
> = {
  MISSING_REVENUE: { icon: IconAlert, chip: 'bg-red-50 text-red-600 ring-red-600/15' },
  UNMAPPED_SENDER: { icon: IconMapping, chip: 'bg-amber-50 text-amber-600 ring-amber-600/15' },
  NEEDS_CONFIRMATION: { icon: IconClock, chip: 'bg-amber-50 text-amber-600 ring-amber-600/15' },
  PARSE_FAILED: { icon: IconMessages, chip: 'bg-red-50 text-red-600 ring-red-600/15' },
  DAILY_SUMMARY: { icon: IconSummary, chip: 'bg-sky-50 text-sky-600 ring-sky-600/15' },
  ANOMALY: { icon: IconTrendUp, chip: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
};

function NotificationSkeleton() {
  return (
    <ul className="divide-y divide-slate-50">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3.5 px-5 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => apiFetch<NotificationItem[]>('/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiFetch(`/notifications/${id}/read`, { method: 'POST' })));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = notifications.data ?? [];
  const unreadIds = useMemo(() => rows.filter((n) => !n.readAt).map((n) => n.id), [rows]);

  return (
    <AppShell title={t.nav.notifications} subtitle="Eksik ciro, anomali ve günlük özet uyarıları">
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-800">{t.nav.notifications}</h2>
            {unreadIds.length > 0 && <Badge tone="danger">{unreadIds.length} okunmamış</Badge>}
          </div>
          {unreadIds.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate(unreadIds)}
            >
              <IconDoubleCheck width={16} height={16} />
              Tümünü okundu işaretle
            </Button>
          )}
        </div>

        {notifications.isError ? (
          <div className="p-5">
            <ErrorState
              message={(notifications.error as Error).message}
              onRetry={() => notifications.refetch()}
            />
          </div>
        ) : notifications.isLoading ? (
          <NotificationSkeleton />
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<IconBell width={40} height={40} />}
              title="Bildirim yok"
              description="Eksik ciro, anomali ve günlük özet bildirimleri burada listelenecek."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {rows.map((n) => {
              const style = eventStyle[n.event] ?? {
                icon: IconBell,
                chip: 'bg-slate-50 text-slate-500 ring-slate-400/15',
              };
              const Icon = style.icon;
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => unread && markRead.mutate(n.id)}
                    className={cn(
                      'flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors',
                      unread ? 'bg-brand/[0.025] hover:bg-brand/5' : 'hover:bg-slate-50/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                        style.chip,
                      )}
                    >
                      <Icon width={18} height={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            'truncate text-sm text-slate-800',
                            unread ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatRelative(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-500">{n.body}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 ring-1 ring-slate-200/60">
                          {notificationEventLabel(n.event)}
                        </span>
                        {unread && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-brand">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            Yeni
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
