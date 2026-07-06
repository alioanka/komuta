'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
} from '@/components/ui';
import { IconCheck } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import type { Outlet, PhoneMapping } from '@/lib/types';

export default function MappingPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canApprove = can('mapping:approve');

  const [selections, setSelections] = useState<Record<string, string>>({});

  const mappings = useQuery({
    queryKey: ['mappings', 'pending'],
    queryFn: () => apiFetch<PhoneMapping[]>('/mappings?status=PENDING'),
  });

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const approve = useMutation({
    mutationFn: (vars: { mappingId: string; outletId: string }) =>
      apiFetch('/mappings/approve', { method: 'POST', body: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mappings'] });
    },
  });

  const rows = mappings.data ?? [];

  return (
    <AppShell title={t.nav.mapping} subtitle="WhatsApp gönderenlerini şubelerle eşleştirin">
      <div className="space-y-5">
        <Card>
          <CardHeader
            title={`${t.nav.mapping} — ${t.status.pending}`}
            subtitle="Eşleşmeyen WhatsApp gönderenlerini bir şubeyle eşleştirin"
            action={rows.length > 0 ? <Badge tone="warning">{rows.length}</Badge> : undefined}
          />

          {mappings.isError ? (
            <div className="p-5">
              <ErrorState message={(mappings.error as Error).message} onRetry={() => mappings.refetch()} />
            </div>
          ) : mappings.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Bekleyen eşleştirme yok"
                description="Tüm gönderenler bir şubeyle eşleştirildi."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((m) => {
                const selected = selections[m.id] ?? m.outletId ?? '';
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-slate-800">{m.phoneE164}</p>
                      <p className="text-xs text-slate-400">
                        {m.employee ? `${m.employee.fullName} · ` : ''}
                        {formatDateTime(m.createdAt)}
                      </p>
                    </div>

                    <div className="w-full sm:w-64">
                      <Select
                        value={selected}
                        disabled={!canApprove}
                        onChange={(e) => setSelections((s) => ({ ...s, [m.id]: e.target.value }))}
                      >
                        <option value="">Şube seçin…</option>
                        {(outlets.data ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Button
                      variant="success"
                      size="sm"
                      disabled={!canApprove || !selected}
                      loading={approve.isPending && approve.variables?.mappingId === m.id}
                      onClick={() => approve.mutate({ mappingId: m.id, outletId: selected })}
                    >
                      <IconCheck width={16} height={16} />
                      Onayla
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {!canApprove && (
          <p className="text-sm text-slate-500">{t.errors.forbidden}</p>
        )}
        {approve.isError && (
          <p className="text-sm text-red-600">{(approve.error as Error).message}</p>
        )}
      </div>
    </AppShell>
  );
}
