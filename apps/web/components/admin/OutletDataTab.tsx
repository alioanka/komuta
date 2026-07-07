'use client';

/**
 * Outlet ("şube") data-management tab: view, edit and delete recorded revenue
 * and monthly accounting rows for a single branch.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, CardBody, CardHeader, Field, FieldError, Input, Select, Skeleton } from '@/components/ui';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { formatDate, formatMoney, formatMonth, formatNumber } from '@/lib/format';
import { entryStatusLabel } from '@/lib/labels';
import { MSG, parseAmountInput } from '@/lib/validate';
import type {
  HeadcountCorrection,
  InventorySnapshot,
  Paginated,
  PayrollEntry,
  PurchaseEntry,
  RevenueEntry,
  StudentCount,
} from '@/lib/types';

const STATUSES = ['CONFIRMED', 'PENDING_REVIEW', 'REJECTED', 'SUPERSEDED'] as const;

export function OutletDataTab({ outletId }: { outletId: string }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const canWrite = can('revenue:write');

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [editing, setEditing] = useState<RevenueEntry | null>(null);
  const [deleting, setDeleting] = useState<RevenueEntry | null>(null);

  const params = new URLSearchParams({ outletId, page: String(page), pageSize: String(pageSize) });
  if (statusFilter) params.set('status', statusFilter);

  const revQ = useQuery({
    queryKey: ['revenue', outletId, statusFilter, page],
    queryFn: () => apiFetch<Paginated<RevenueEntry>>(`/revenue?${params.toString()}`),
  });

  const err = (e: unknown) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['revenue', outletId] });
    void qc.invalidateQueries({ queryKey: ['outlet', outletId] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/revenue/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setDeleting(null); push({ tone: 'success', title: 'Kayıt silindi' }); invalidate(); },
    onError: (e) => { setDeleting(null); err(e); },
  });

  const rows = revQ.data?.items ?? [];
  const total = revQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`${t.metrics.revenue} Kayıtları`}
          subtitle={`Toplam ${total} kayıt · düzenlenebilir / silinebilir`}
        />
        <div className="flex flex-wrap gap-3 px-5 pb-3 pt-1">
          <Select
            className="max-w-[14rem]"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm durumlar</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{entryStatusLabel(s, t)}</option>
            ))}
          </Select>
        </div>

        {revQ.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Kayıt yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Tarih</th>
                  <th className="px-5 py-3 text-right font-medium">Tutar</th>
                  <th className="px-5 py-3 font-medium">Durum</th>
                  <th className="px-5 py-3 font-medium">Kaynak</th>
                  <th className="px-5 py-3 font-medium">Not</th>
                  {canWrite && <th className="px-5 py-3 text-right font-medium">İşlemler</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-700">{formatDate(r.businessDate, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-800">{formatMoney(r.amount, true)}</td>
                    <td className="px-5 py-3"><Badge tone={r.status === 'CONFIRMED' ? 'success' : r.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>{entryStatusLabel(r.status, t)}</Badge></td>
                    <td className="px-5 py-3 text-slate-500">{r.source === 'WHATSAPP' ? 'WhatsApp' : r.source === 'MANUAL' ? 'Manuel' : r.source}</td>
                    <td className="px-5 py-3 text-slate-500">{r.note ?? '—'}</td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Düzenle</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(r)}>Sil</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>Sayfa {page} / {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
            </div>
          </div>
        )}
      </Card>

      <AccountingSection outletId={outletId} canWrite={can('payroll:write')} />

      {editing && (
        <RevenueEditModal entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        title="Ciro kaydını sil"
        confirmLabel="Sil"
        message={`${deleting ? formatMoney(deleting.amount, true) : ''} tutarlı kayıt kalıcı olarak silinsin mi?`}
      />
    </div>
  );
}

function RevenueEditModal({ entry, onClose, onSaved }: { entry: RevenueEntry; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [amount, setAmount] = useState(entry.amount);
  const [date, setDate] = useState(entry.businessDate.slice(0, 10));
  const [note, setNote] = useState(entry.note ?? '');
  const [status, setStatus] = useState(entry.status);
  const [error, setError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: () => {
      const parsed = parseAmountInput(amount);
      if (parsed === null) { setError(MSG.amount); throw new Error(MSG.amount); }
      return apiFetch(`/revenue/${entry.id}`, {
        method: 'PATCH',
        body: { amount: parsed.toFixed(2), businessDate: date, note: note.trim() || undefined, status },
      });
    },
    onSuccess: () => { push({ tone: 'success', title: 'Kayıt güncellendi' }); onSaved(); },
    onError: (e) => { if ((e as Error).message !== MSG.amount) push({ tone: 'danger', title: 'Güncellenemedi', body: (e as Error).message }); },
  });

  return (
    <Modal open onClose={onClose} title="Ciro kaydını düzenle" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>Kaydet</Button>
      </>
    }>
      <div className="space-y-4">
        <Field label="Tutar (₺)">
          <Input value={amount} onChange={(e) => { setAmount(e.target.value); setError(undefined); }} inputMode="decimal" />
          <FieldError message={error} />
        </Field>
        <Field label="Tarih">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{entryStatusLabel(s, t)}</option>)}
          </Select>
        </Field>
        <Field label="Not">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Monthly accounting rows — view + delete (editing monthly values is done on the Muhasebe page). */
function AccountingSection({ outletId, canWrite }: { outletId: string; canWrite: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { push } = useToast();

  const q = <T,>(key: string, path: string) =>
    useQuery({ queryKey: [key, outletId], queryFn: () => apiFetch<T[]>(`${path}?outletId=${outletId}`) });

  const payroll = q<PayrollEntry>('payroll', '/accounting/payroll');
  const purchases = q<PurchaseEntry>('purchases', '/accounting/purchases');
  const inventory = q<InventorySnapshot>('inventory', '/accounting/inventory');
  const students = q<StudentCount>('student', '/accounting/student-count');
  const headcount = q<HeadcountCorrection>('headcount', '/accounting/headcount');

  const makeDelete = (path: string, keys: string[]) =>
    useMutation({
      mutationFn: (id: string) => apiFetch(`${path}/${id}`, { method: 'DELETE' }),
      onSuccess: () => { push({ tone: 'success', title: 'Kayıt silindi' }); keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k, outletId] })); void qc.invalidateQueries({ queryKey: ['outlet', outletId] }); },
      onError: (e) => push({ tone: 'danger', title: 'Silinemedi', body: (e as Error).message }),
    });

  const delPayroll = makeDelete('/accounting/payroll', ['payroll']);
  const delPurchase = makeDelete('/accounting/purchases', ['purchases']);
  const delInventory = makeDelete('/accounting/inventory', ['inventory']);
  const delStudent = makeDelete('/accounting/student-count', ['student']);
  const delHeadcount = makeDelete('/accounting/headcount', ['headcount']);

  const block = (
    title: string,
    subtitle: string,
    rows: { id: string; left: string; right: string }[] | undefined,
    onDelete: (id: string) => void,
    loading: boolean,
  ) => (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody className="space-y-1">
        {!rows ? (
          <Skeleton className="h-8 w-full" />
        ) : rows.length === 0 ? (
          <span className="text-sm text-slate-400">Kayıt yok.</span>
        ) : (
          <ul className="divide-y divide-slate-50">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">{r.left}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular-nums text-slate-800">{r.right}</span>
                  {canWrite && <Button size="sm" variant="ghost" disabled={loading} onClick={() => onDelete(r.id)}>Sil</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {block(t.metrics.payroll, 'Aylık personel maaşı', payroll.data?.map((r) => ({ id: r.id, left: formatMonth(r.periodMonth), right: formatMoney(r.totalSalary, true) })), delPayroll.mutate, delPayroll.isPending)}
      {block(t.metrics.purchases, 'Aylık mal alımı', purchases.data?.map((r) => ({ id: r.id, left: formatMonth(r.periodMonth), right: formatMoney(r.amount, true) })), delPurchase.mutate, delPurchase.isPending)}
      {block(t.metrics.inventory, 'Stok değeri', inventory.data?.map((r) => ({ id: r.id, left: formatDate(r.asOfDate, { day: '2-digit', month: 'short', year: 'numeric' }), right: formatMoney(r.stockValue, true) })), delInventory.mutate, delInventory.isPending)}
      {block(t.metrics.studentCount, `${t.metrics.ortaokul} / ${t.metrics.lise}`, students.data?.map((r) => ({ id: r.id, left: formatMonth(r.periodMonth), right: `${formatNumber(r.ortaokul)} / ${formatNumber(r.lise)}` })), delStudent.mutate, delStudent.isPending)}
      {block(t.metrics.employeeCount, 'Çalışan sayısı düzeltmeleri', headcount.data?.map((r) => ({ id: r.id, left: formatMonth(r.periodMonth), right: formatNumber(r.employeeCount) })), delHeadcount.mutate, delHeadcount.isPending)}
    </div>
  );
}
