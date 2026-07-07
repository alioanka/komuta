'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { RevenueAreaChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import { OutletFormModal } from '@/components/admin/OutletFormModal';
import { Modal, ConfirmDialog } from '@/components/ui/overlay';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  FieldError,
  Input,
  Skeleton,
  cn,
} from '@/components/ui';
import { formatMoney, formatNumber } from '@/lib/format';
import { outletTypeLabel } from '@/lib/labels';
import { IconEdit, IconPlus, IconTag, IconTrash } from '@/components/icons';
import { MSG } from '@/lib/validate';
import type { Company, Outlet, RevenueEntry } from '@/lib/types';

const TREND_DAYS = 14;

type Brand = Company['brands'][number];

/** Local date as YYYY-MM-DD, offset by `deltaDays`. */
function localDate(deltaDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The revenue endpoint may return a bare array or a paginated {items,total}. */
function asItems<T>(res: T[] | { items: T[] }): T[] {
  return Array.isArray(res) ? res : (res?.items ?? []);
}

/* ------------------------------------------------ Brand form modal ------ */
function BrandFormModal({
  open,
  onClose,
  companyId,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  brand?: Brand | null;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const isEdit = !!brand;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(brand?.name ?? '');
    setError(undefined);
  }, [open, brand]);

  const save = useMutation({
    mutationFn: () =>
      isEdit && brand
        ? apiFetch(`/companies/brand/${brand.id}`, { method: 'PATCH', body: { name: name.trim() } })
        : apiFetch('/companies/brand', { method: 'POST', body: { companyId, name: name.trim() } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies'] });
      push({ tone: 'success', title: isEdit ? 'Marka güncellendi' : 'Marka eklendi', body: name.trim() });
      onClose();
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  function submit() {
    if (!name.trim()) return setError(MSG.required);
    setError(undefined);
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Markayı Düzenle' : 'Yeni Marka'}
      subtitle="Markalar şubeleri gruplamak için kullanılır (örn. pizza markası)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {isEdit ? 'Kaydet' : 'Ekle'}
          </Button>
        </>
      }
    >
      <Field label="Marka Adı">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Pizza Locale" />
        <FieldError message={error} />
      </Field>
    </Modal>
  );
}

/* ----------------------------------------------------------- Page ------- */
export default function CompanyDetailPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const params = useParams<{ company: string }>();
  const companyId = params.company;

  const canCreateOutlet = can('outlet:create');
  const canUpdateOutlet = can('outlet:update');
  const canCreateBrand = can('brand:create');
  const canUpdateBrand = can('brand:update');

  const [outletModalOpen, setOutletModalOpen] = useState(false);
  const [editOutlet, setEditOutlet] = useState<Outlet | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [deleteBrand, setDeleteBrand] = useState<Brand | null>(null);

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const company = companies.data?.find((c) => c.id === companyId);
  const companyOutlets = useMemo(
    () => (outlets.data ?? []).filter((o) => o.companyId === companyId),
    [outlets.data, companyId],
  );

  const expectsCount = companyOutlets.filter((o) => o.expectsDailyRevenue).length;

  // Lightweight company trend: fetch the recent revenue window once and
  // aggregate per-day for this company's outlets on the client.
  const from = localDate(-(TREND_DAYS - 1));
  const to = localDate(0);
  const revenue = useQuery({
    queryKey: ['revenue', 'range', from, to],
    queryFn: () => apiFetch<RevenueEntry[] | { items: RevenueEntry[] }>(`/revenue?from=${from}&to=${to}`),
  });

  const trend = useMemo(() => {
    const outletIds = new Set(companyOutlets.map((o) => o.id));
    const byDate = new Map<string, number>();
    for (let i = 0; i < TREND_DAYS; i++) byDate.set(localDate(-(TREND_DAYS - 1) + i), 0);
    for (const entry of asItems(revenue.data ?? [])) {
      if (entry.status !== 'CONFIRMED' || !outletIds.has(entry.outletId)) continue;
      const day = entry.businessDate.slice(0, 10);
      if (byDate.has(day)) byDate.set(day, (byDate.get(day) ?? 0) + Number(entry.amount));
    }
    return [...byDate.entries()].map(([date, value]) => ({ date, value }));
  }, [revenue.data, companyOutlets]);

  const trendTotal = trend.reduce((sum, p) => sum + p.value, 0);
  const hasTrendData = trend.some((p) => p.value > 0);

  const removeBrand = useMutation({
    mutationFn: (id: string) => apiFetch(`/companies/brand/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies'] });
      push({ tone: 'success', title: 'Marka silindi', body: deleteBrand?.name });
      setDeleteBrand(null);
    },
    onError: (e) => {
      push({ tone: 'danger', title: 'Marka silinemedi', body: (e as Error).message });
      setDeleteBrand(null);
    },
  });

  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: t.domain.outlet,
      render: (o) => (
        <Link
          href={`/sube/${o.id}`}
          className={cn('font-medium text-slate-800 hover:text-brand', !o.isActive && 'opacity-50')}
        >
          {o.name}
          {!o.isActive && (
            <Badge tone="neutral" className="ml-2">
              Pasif
            </Badge>
          )}
        </Link>
      ),
    },
    {
      key: 'code',
      header: 'Kod',
      render: (o) => <span className="font-mono text-xs text-slate-500">{o.code}</span>,
    },
    { key: 'type', header: 'Tür', render: (o) => outletTypeLabel(o.type, t) },
    { key: 'brand', header: t.domain.brand, render: (o) => o.brand?.name ?? '—' },
    { key: 'city', header: 'Şehir', render: (o) => o.city ?? '—' },
    {
      key: 'expects',
      header: 'Günlük Ciro',
      align: 'center',
      render: (o) =>
        o.expectsDailyRevenue ? <Badge tone="success">Evet</Badge> : <Badge tone="neutral">Hayır</Badge>,
    },
    ...(canUpdateOutlet
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (o: Outlet) => (
              <button
                onClick={() => {
                  setEditOutlet(o);
                  setOutletModalOpen(true);
                }}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand"
                title="Düzenle"
              >
                <IconEdit width={16} height={16} />
              </button>
            ),
          },
        ]
      : []),
  ];

  const isError = companies.isError || outlets.isError;
  const isLoading = companies.isLoading || outlets.isLoading;

  return (
    <AppShell title={company?.name ?? t.domain.company} subtitle="Firma detayı ve şube performansı">
      <div className="mb-5">
        <Link href="/firmalar" className="text-sm text-slate-500 hover:text-brand">
          ← {t.nav.companies}
        </Link>
      </div>

      {isError ? (
        <ErrorState
          message={((companies.error || outlets.error) as Error)?.message ?? 'Hata'}
          onRetry={() => {
            companies.refetch();
            outlets.refetch();
          }}
        />
      ) : !isLoading && !company ? (
        <EmptyState title={t.errors.notFound} description="Bu firma bulunamadı veya yetkiniz yok." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label={t.nav.outlets}
              value={formatNumber(companyOutlets.length)}
              tone="brand"
              loading={isLoading}
            />
            <KpiCard
              label="Günlük Ciro Beklenen"
              value={formatNumber(expectsCount)}
              tone="accent"
              loading={isLoading}
            />
            <KpiCard
              label={t.domain.brand}
              value={formatNumber(company?.brands.length ?? 0)}
              tone="success"
              loading={isLoading}
            />
          </div>

          {/* Company revenue trend */}
          <Card>
            <CardHeader
              title={`${t.metrics.revenue} — son ${TREND_DAYS} gün`}
              subtitle="Şubelerin onaylanmış günlük toplamı"
              action={
                !revenue.isLoading && hasTrendData ? (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Toplam</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatMoney(trendTotal)}
                    </p>
                  </div>
                ) : undefined
              }
            />
            <CardBody>
              {revenue.isLoading || isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : !hasTrendData ? (
                <EmptyState
                  title="Ciro yok"
                  description="Bu dönemde firmaya ait onaylanmış ciro kaydı bulunmuyor."
                />
              ) : (
                <RevenueAreaChart data={trend} height={220} />
              )}
            </CardBody>
          </Card>

          {/* Brands */}
          <Card>
            <CardHeader
              title={t.domain.brand}
              subtitle="Firmaya bağlı markalar"
              action={
                canCreateBrand ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditBrand(null);
                      setBrandModalOpen(true);
                    }}
                  >
                    <IconPlus width={16} height={16} />
                    Yeni Marka
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {(company?.brands ?? []).length === 0 ? (
                <EmptyState
                  icon={<IconTag width={36} height={36} />}
                  title="Henüz marka yok"
                  description="Markalar isteğe bağlıdır; şubeleri (örn. pizza şubeleri) gruplamak için kullanılır."
                  action={
                    canCreateBrand ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditBrand(null);
                          setBrandModalOpen(true);
                        }}
                      >
                        <IconPlus width={16} height={16} />
                        Yeni Marka
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {(company?.brands ?? []).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3.5 pr-1.5 text-sm font-medium text-slate-700"
                    >
                      {b.name}
                      {canUpdateBrand && (
                        <>
                          <button
                            onClick={() => {
                              setEditBrand(b);
                              setBrandModalOpen(true);
                            }}
                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-brand"
                            title="Yeniden adlandır"
                          >
                            <IconEdit width={13} height={13} />
                          </button>
                          <button
                            onClick={() => setDeleteBrand(b)}
                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white hover:text-brand-danger"
                            title="Sil"
                          >
                            <IconTrash width={13} height={13} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Outlets */}
          <Card>
            <CardHeader
              title={t.nav.outlets}
              subtitle={`${company?.name ?? ''} şubeleri`}
              action={
                canCreateOutlet ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditOutlet(null);
                      setOutletModalOpen(true);
                    }}
                  >
                    <IconPlus width={16} height={16} />
                    Yeni Şube
                  </Button>
                ) : undefined
              }
            />
            {companyOutlets.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Henüz şube yok"
                  description="Bu firmaya bağlı ilk şubeyi ekleyin."
                  action={
                    canCreateOutlet ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditOutlet(null);
                          setOutletModalOpen(true);
                        }}
                      >
                        <IconPlus width={16} height={16} />
                        Yeni Şube
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <DataTable columns={columns} rows={companyOutlets} getRowKey={(o) => o.id} />
            )}
          </Card>
        </div>
      )}

      <OutletFormModal
        open={outletModalOpen}
        onClose={() => setOutletModalOpen(false)}
        outlet={editOutlet}
        companies={companies.data ?? []}
        defaultCompanyId={companyId}
      />

      <BrandFormModal
        open={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        companyId={companyId}
        brand={editBrand}
      />

      <ConfirmDialog
        open={!!deleteBrand}
        onClose={() => setDeleteBrand(null)}
        onConfirm={() => deleteBrand && removeBrand.mutate(deleteBrand.id)}
        loading={removeBrand.isPending}
        title="Markayı sil"
        message={
          <>
            <strong>{deleteBrand?.name}</strong> markası silinecek. Bu markaya bağlı şubeler markasız kalır;
            şubeler silinmez.
          </>
        }
        confirmLabel="Markayı Sil"
      />
    </AppShell>
  );
}
