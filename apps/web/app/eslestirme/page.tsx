'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
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
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/overlay';
import { MappingFormModal } from '@/components/admin/MappingFormModal';
import { IconCheck } from '@/components/icons';
import { formatDateTime, formatPhone } from '@/lib/format';
import { mappingStatusLabel, mappingStatusTone } from '@/lib/labels';
import { useToast } from '@/components/Toast';
import type { Outlet, PhoneMapping } from '@/lib/types';

export default function MappingPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const canApprove = can('mapping:approve');

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PhoneMapping | null>(null);
  const [deleting, setDeleting] = useState<PhoneMapping | null>(null);

  const pending = useQuery({
    queryKey: ['mappings', 'pending'],
    queryFn: () => apiFetch<PhoneMapping[]>('/mappings?status=PENDING'),
  });
  const all = useQuery({
    queryKey: ['mappings', 'all'],
    queryFn: () => apiFetch<PhoneMapping[]>('/mappings'),
  });
  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['mappings'] });

  const approve = useMutation({
    mutationFn: (vars: { mappingId: string; outletId: string }) =>
      apiFetch('/mappings/approve', { method: 'POST', body: vars }),
    onSuccess: () => {
      push({ tone: 'success', title: 'Eşleştirme onaylandı' });
      invalidate();
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  const block = useMutation({
    mutationFn: (id: string) => apiFetch(`/mappings/${id}`, { method: 'PATCH', body: { status: 'BLOCKED' } }),
    onSuccess: () => {
      push({ tone: 'success', title: 'Numara engellendi' });
      invalidate();
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      push({ tone: 'success', title: 'Eşleştirme silindi' });
      setDeleting(null);
      invalidate();
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  const pendingRows = pending.data ?? [];
  const outletList = outlets.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (all.data ?? []).filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.phoneE164.toLowerCase().includes(q) ||
        (m.outlet?.name ?? '').toLowerCase().includes(q) ||
        (m.employee?.fullName ?? '').toLowerCase().includes(q)
      );
    });
  }, [all.data, search, statusFilter]);

  return (
    <AppShell title={t.nav.mapping} subtitle="WhatsApp gönderenlerini şubelerle eşleştirin">
      <div className="space-y-5">
        {/* --- Pending approvals --- */}
        <Card>
          <CardHeader
            title={`${t.nav.mapping} — ${t.status.pending}`}
            subtitle="Eşleşmeyen WhatsApp gönderenlerini bir şubeyle eşleştirin"
            action={pendingRows.length > 0 ? <Badge tone="warning">{pendingRows.length}</Badge> : undefined}
          />
          {pending.isError ? (
            <div className="p-5">
              <ErrorState message={(pending.error as Error).message} onRetry={() => pending.refetch()} />
            </div>
          ) : pending.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Bekleyen eşleştirme yok" description="Tüm gönderenler bir şubeyle eşleştirildi." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingRows.map((m) => {
                const selected = selections[m.id] ?? m.outletId ?? '';
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-slate-800">{formatPhone(m.phoneE164)}</p>
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
                        {outletList.map((o) => (
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

        {/* --- All mappings management --- */}
        <Card>
          <CardHeader
            title="Tüm Eşleştirmeler"
            subtitle="Kayıtlı telefon → şube eşleştirmelerini yönetin"
            action={
              canApprove ? (
                <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  Yeni Eşleştirme
                </Button>
              ) : undefined
            }
          />
          <div className="flex flex-wrap gap-3 px-5 pb-3 pt-1">
            <Input
              className="max-w-xs"
              placeholder="Numara, şube veya çalışan ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select className="max-w-[12rem]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm durumlar</option>
              <option value="ACTIVE">{mappingStatusLabel('ACTIVE')}</option>
              <option value="PENDING">{mappingStatusLabel('PENDING')}</option>
              <option value="BLOCKED">{mappingStatusLabel('BLOCKED')}</option>
            </Select>
          </div>

          {all.isError ? (
            <div className="p-5">
              <ErrorState message={(all.error as Error).message} onRetry={() => all.refetch()} />
            </div>
          ) : all.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Eşleştirme bulunamadı" description="Arama kriterlerinize uygun kayıt yok." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">Numara</th>
                    <th className="px-5 py-3 font-medium">Şube</th>
                    <th className="px-5 py-3 font-medium">Çalışan</th>
                    <th className="px-5 py-3 font-medium">Durum</th>
                    <th className="px-5 py-3 text-right font-medium">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-mono text-slate-800">{formatPhone(m.phoneE164)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {m.outlet ? `${m.outlet.name} (${m.outlet.code})` : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{m.employee?.fullName ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge tone={mappingStatusTone(m.status)}>{mappingStatusLabel(m.status)}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {canApprove && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setFormOpen(true); }}>
                                Düzenle
                              </Button>
                              {m.status !== 'BLOCKED' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => block.mutate(m.id)}
                                  loading={block.isPending && block.variables === m.id}
                                >
                                  Engelle
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setDeleting(m)}>
                                Sil
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {!canApprove && <p className="text-sm text-slate-500">{t.errors.forbidden}</p>}
      </div>

      <MappingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mapping={editing}
        outlets={outletList}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        tone="danger"
        title="Eşleştirmeyi sil"
        confirmLabel="Sil"
        message={`${deleting ? formatPhone(deleting.phoneE164) : ''} numarasının eşleştirmesi silinsin mi? Mesaj geçmişi korunur.`}
      />
    </AppShell>
  );
}
