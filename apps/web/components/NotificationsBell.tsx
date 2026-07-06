'use client';

/**
 * TopBar bell: unread-count badge (60s poll) + live SSE subscription that
 * bumps the badge instantly and raises a toast. The SSE connection is
 * failure-tolerant: it retries silently with exponential backoff and never
 * throws into the UI.
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, apiFetch, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { IconBell } from '@/components/icons';
import type { NotificationEvent } from '@komuta/shared';

interface SseNotification {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  createdAt: string;
}

export function NotificationsBell() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const pathname = usePathname();
  const enabled = !!user && can('notification:read');

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiFetch<{ count: number }>('/notifications/unread-count'),
    enabled,
    refetchInterval: 60_000,
  });

  // Live SSE stream — silent retry with backoff; never crashes the UI.
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let disposed = false;

    const scheduleReconnect = () => {
      if (disposed) return;
      attempts += 1;
      const delay = Math.min(60_000, 2_000 * 2 ** Math.min(attempts, 5));
      timer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      const token = getToken();
      if (!token) {
        scheduleReconnect();
        return;
      }
      try {
        es = new EventSource(
          `${apiBaseUrl()}/notifications/stream?token=${encodeURIComponent(token)}`,
        );
      } catch {
        scheduleReconnect();
        return;
      }
      es.onopen = () => {
        attempts = 0;
      };
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as SseNotification;
          if (!data?.title) return;
          push({ title: data.title, body: data.body, tone: 'info' });
          void qc.invalidateQueries({ queryKey: ['notifications'] });
        } catch {
          /* malformed event — ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [enabled, push, qc]);

  if (!enabled) return null;

  const count = unread.data?.count ?? 0;
  const active = pathname === '/bildirimler';

  return (
    <Link
      href="/bildirimler"
      aria-label={`Bildirimler${count > 0 ? ` (${count} okunmamış)` : ''}`}
      className={`relative rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
        active ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      <IconBell width={19} height={19} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-danger px-1 text-[10px] font-bold leading-none text-white shadow-sm">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
