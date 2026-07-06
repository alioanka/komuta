'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, cn } from '@/components/ui';
import {
  IconArrowLeft,
  IconInbox,
  IconMessages,
  IconSearch,
  IconSend,
} from '@/components/icons';
import { formatDate, formatMoney, formatPhone, formatRelative, formatTime } from '@/lib/format';
import { resolutionStatusLabel, resolutionStatusTone } from '@/lib/labels';
import type { WhatsAppMessage } from '@/lib/types';

interface Conversation {
  phone: string;
  last: WhatsAppMessage;
  total: number;
}

/** Counterpart phone of a message (the non-business side). */
function counterpart(m: WhatsAppMessage): string {
  return m.direction === 'IN' ? m.fromPhone : m.toPhone;
}

function ConversationSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-100" />
      <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-400">
        {formatDate(date, { day: '2-digit', month: 'long', year: 'numeric' })}
      </span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

function MessageBubble({ m, t }: { m: WhatsAppMessage; t: ReturnType<typeof useI18n>['t'] }) {
  const inbound = m.direction === 'IN';
  return (
    <div className={cn('flex', inbound ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[85%] sm:max-w-[70%]', inbound ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
            inbound
              ? 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800'
              : 'rounded-br-md bg-brand text-white',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          {inbound && (m.parsedAmount != null || m.resolutionStatus) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {m.parsedAmount != null && (
                <span className="inline-flex items-center rounded-md bg-brand/5 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand ring-1 ring-brand/15">
                  {formatMoney(m.parsedAmount, true)}
                </span>
              )}
              {m.resolutionStatus && (
                <Badge tone={resolutionStatusTone(m.resolutionStatus)}>
                  {resolutionStatusLabel(m.resolutionStatus, t)}
                </Badge>
              )}
            </div>
          )}
        </div>
        <p
          className={cn(
            'mt-1 px-1 text-[11px] text-slate-400',
            inbound ? 'text-left' : 'text-right',
          )}
        >
          {formatTime(m.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canSend = can('message:send');

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const messages = useQuery({
    queryKey: ['messages', 'list'],
    queryFn: () => apiFetch<WhatsAppMessage[]>('/messages'),
    refetchInterval: 20_000,
  });

  const thread = useQuery({
    queryKey: ['messages', 'thread', selected],
    queryFn: () => apiFetch<WhatsAppMessage[]>(`/messages/thread/${encodeURIComponent(selected!)}`),
    enabled: !!selected,
    refetchInterval: 10_000,
  });

  const windowQ = useQuery({
    queryKey: ['messages', 'window', selected],
    queryFn: () => apiFetch<{ open: boolean }>(`/messages/window/${encodeURIComponent(selected!)}`),
    enabled: !!selected && canSend,
    refetchInterval: 60_000,
  });

  const send = useMutation({
    mutationFn: (vars: { toPhone: string; body: string }) =>
      apiFetch('/messages/send', { method: 'POST', body: vars }),
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  // Conversations: newest-first list grouped by counterpart phone.
  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>();
    for (const m of messages.data ?? []) {
      const phone = counterpart(m);
      const existing = map.get(phone);
      if (existing) existing.total += 1;
      else map.set(phone, { phone, last: m, total: 1 });
    }
    return [...map.values()];
  }, [messages.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.phone.toLocaleLowerCase('tr').includes(q) ||
        c.last.body.toLocaleLowerCase('tr').includes(q),
    );
  }, [conversations, search]);

  // Scroll to the newest message whenever the thread changes.
  const threadLen = thread.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [threadLen, selected]);

  const windowOpen = windowQ.data?.open;

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selected || send.isPending) return;
    send.mutate({ toPhone: selected, body });
  }

  return (
    <AppShell title={t.nav.messages} subtitle="WhatsApp gelen kutusu ve konuşmalar">
      <Card className="flex h-[calc(100dvh-10.5rem)] min-h-[420px] overflow-hidden">
        {/* Conversation list */}
        <div
          className={cn(
            'w-full flex-col border-slate-100 lg:flex lg:w-80 lg:shrink-0 lg:border-r',
            selected ? 'hidden' : 'flex',
          )}
        >
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <IconSearch
                width={16}
                height={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Numara veya mesaj ara…"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {messages.isError ? (
              <div className="p-4">
                <ErrorState
                  message={(messages.error as Error).message}
                  onRetry={() => messages.refetch()}
                />
              </div>
            ) : messages.isLoading ? (
              <ConversationSkeleton />
            ) : filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<IconInbox width={36} height={36} />}
                  title={search ? 'Sonuç bulunamadı' : 'Henüz mesaj yok'}
                  description={
                    search
                      ? 'Farklı bir arama deneyin.'
                      : 'Şubeler ciro gönderdiğinde konuşmalar burada listelenir.'
                  }
                />
              </div>
            ) : (
              <ul className="space-y-0.5 p-2">
                {filtered.map((c) => {
                  const active = selected === c.phone;
                  const inboundLast = c.last.direction === 'IN';
                  return (
                    <li key={c.phone}>
                      <button
                        onClick={() => setSelected(c.phone)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                          active ? 'bg-brand/5 ring-1 ring-brand/15' : 'hover:bg-slate-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                            inboundLast
                              ? 'bg-brand/10 text-brand'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {c.phone.replace(/\D/g, '').slice(-2) || '··'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-sm text-slate-800',
                                inboundLast ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {formatPhone(c.phone)}
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {formatRelative(c.last.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span
                              className={cn(
                                'shrink-0 text-xs',
                                inboundLast ? 'text-brand-accent' : 'text-slate-400',
                              )}
                              aria-hidden
                            >
                              {inboundLast ? '↘' : '↗'}
                            </span>
                            <span
                              className={cn(
                                'truncate text-xs',
                                inboundLast ? 'font-medium text-slate-600' : 'text-slate-400',
                              )}
                            >
                              {c.last.body || '—'}
                            </span>
                            {c.last.resolutionStatus && (
                              <Badge
                                tone={resolutionStatusTone(c.last.resolutionStatus)}
                                className="shrink-0 px-1.5 py-0 text-[10px]"
                              >
                                {resolutionStatusLabel(c.last.resolutionStatus, t)}
                              </Badge>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Thread pane */}
        <div className={cn('min-w-0 flex-1 flex-col lg:flex', selected ? 'flex' : 'hidden')}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={<IconMessages width={40} height={40} />}
                title="Bir konuşma seçin"
                description="Soldaki listeden bir numara seçerek mesaj geçmişini görüntüleyin."
              />
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
                  aria-label="Geri"
                >
                  <IconArrowLeft width={18} height={18} />
                </button>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {selected.replace(/\D/g, '').slice(-2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {formatPhone(selected)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {thread.data ? `${thread.data.length} mesaj` : ' '}
                  </p>
                </div>
                {canSend && windowQ.data && (
                  <Badge tone={windowOpen ? 'success' : 'neutral'}>
                    {windowOpen ? 'Pencere açık' : 'Pencere kapalı'}
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 px-4 py-4 scrollbar-thin">
                {thread.isError ? (
                  <ErrorState
                    message={(thread.error as Error).message}
                    onRetry={() => thread.refetch()}
                  />
                ) : thread.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-3/5 rounded-2xl" />
                    <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
                    <Skeleton className="h-14 w-2/5 rounded-2xl" />
                  </div>
                ) : (thread.data ?? []).length === 0 ? (
                  <EmptyState title="Mesaj yok" description="Bu numarayla henüz mesajlaşma yok." />
                ) : (
                  <div className="space-y-2.5">
                    {(thread.data ?? []).map((m, i, arr) => {
                      const day = m.createdAt.slice(0, 10);
                      const prevDay = i > 0 ? arr[i - 1].createdAt.slice(0, 10) : null;
                      return (
                        <div key={m.id}>
                          {day !== prevDay && <DaySeparator date={day} />}
                          <MessageBubble m={m} t={t} />
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-slate-100 bg-white p-3">
                {canSend ? (
                  <>
                    {windowQ.data && !windowOpen && (
                      <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 ring-1 ring-amber-600/15">
                        24 saat penceresi kapalı — şablon kullanılacak
                      </p>
                    )}
                    {send.isError && (
                      <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 ring-1 ring-red-600/15">
                        {(send.error as Error).message}
                      </p>
                    )}
                    <form onSubmit={onSend} className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSend(e);
                          }
                        }}
                        rows={1}
                        placeholder="Mesaj yazın…"
                        className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                      <Button
                        type="submit"
                        className="h-11 w-11 shrink-0 rounded-xl px-0"
                        disabled={!draft.trim()}
                        loading={send.isPending}
                        aria-label="Gönder"
                        title="Gönder"
                      >
                        {!send.isPending && <IconSend width={18} height={18} />}
                      </Button>
                    </form>
                  </>
                ) : (
                  <p className="px-1 py-1.5 text-center text-xs text-slate-400">
                    Mesaj göndermek için yetkiniz yok.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
