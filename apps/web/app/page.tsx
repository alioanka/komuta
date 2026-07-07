'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { RevenueAreaChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import { Drawer } from '@/components/ui/overlay';
import { useToast } from '@/components/Toast';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui';
import { IconArrowDown, IconArrowUp, IconSliders } from '@/components/icons';
import { formatDate, formatMoney, formatNumber, formatRelative } from '@/lib/format';
import { notificationEventLabel } from '@/lib/labels';
import type {
  BranchReportRow,
  Company,
  DashboardConfig,
  DashboardOverview,
  DashboardWidgetId,
  MissingOutlet,
  NotificationItem,
  PerCompany,
} from '@/lib/types';

/* --------------------------------------------------------- config --- */
const WIDGET_META: { id: DashboardWidgetId; label: string; description: string }[] = [
  { id: 'kpis', label: 'Özet kartları', description: 'Bugünkü ciro, raporlayan şube, onay bekleyen' },
  { id: 'trend', label: '14 günlük ciro trendi', description: 'Onaylanmış toplam ciro grafiği' },
  { id: 'perCompany', label: 'Firma performansı', description: 'Firma bazında bugünkü ciro tablosu' },
  { id: 'missing', label: 'Bugün eksik', description: 'Ciro bildirimi bekleyen şubeler' },
  { id: 'studentVsRevenue', label: 'Öğrenci ↔ Ciro', description: 'En yüksek cirolu şubeler ve öğrenci sayıları' },
  { id: 'notifications', label: 'Son bildirimler', description: 'En son 5 uyarı' },
];

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: WIDGET_META.map((w) => ({ id: w.id, visible: true })),
  companyId: '',
};

/** Merge a stored config with the registry so new widgets always appear. */
function normalizeConfig(raw: DashboardConfig | null | undefined): DashboardConfig {
  if (!raw || !Array.isArray(raw.widgets)) return DEFAULT_CONFIG;
  const known = new Set(WIDGET_META.map((w) => w.id));
  const seen = new Set<DashboardWidgetId>();
  const widgets = raw.widgets
    .filter((w) => w && known.has(w.id) && !seen.has(w.id) && seen.add(w.id))
    .map((w) => ({ id: w.id, visible: w.visible !== false }));
  for (const w of WIDGET_META) {
    if (!seen.has(w.id)) widgets.push({ id: w.id, visible: true });
  }
  return { widgets, companyId: raw.companyId ?? '' };
}

export default function OverviewPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { push } = useToast();

  const configQ = useQuery({
    queryKey: ['dashboard', 'config'],
    queryFn: () => apiFetch<DashboardConfig | null>('/dashboard/config'),
  });

  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Hydrate local config once the saved config resolves.
  useEffect(() => {
    if (configQ.isSuccess) setConfig(normalizeConfig(configQ.data));
  }, [configQ.isSuccess, configQ.data]);

  const companyId = config.companyId ?? '';

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });

  const overview = useQuery({
    queryKey: ['dashboard', 'overview', companyId],
    queryFn: () =>
      apiFetch<DashboardOverview>(`/dashboard/overview${companyId ? `?companyId=${companyId}` : ''}`),
  });

  const missing = useQuery({
    queryKey: ['monitor', 'missing'],
    queryFn: () => apiFetch<MissingOutlet[]>('/monitor/missing'),
  });

  const isVisible = (id: DashboardWidgetId) =>
    config.widgets.some((w) => w.id === id && w.visible);

  const branches = useQuery({
    queryKey: ['reports', 'branches', 'dashboard', companyId],
    queryFn: () =>
      apiFetch<BranchReportRow[]>(`/reports/branches${companyId ? `?companyId=${companyId}` : ''}`),
    enabled: isVisible('studentVsRevenue'),
  });

  const notifications = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => apiFetch<NotificationItem[]>('/notifications'),
    enabled: isVisible('notifications'),
  });

  const saveConfig = useMutation({
    mutationFn: (next: DashboardConfig) =>
      apiFetch<DashboardConfig>('/dashboard/config', { method: 'PUT', body: { config: next } }),
    onSuccess: (saved) => {
      qc.setQueryData(['dashboard', 'config'], saved);
      push({ tone: 'success', title: 'Panel kaydedildi' });
      setCustomizeOpen(false);
    },
    onError: (e) => push({ tone: 'danger', title: 'Kaydedilemedi', body: (e as Error).message }),
  });

  const data = overview.data;
  const trendData = (data?.trend ?? []).map((p) => ({ date: p.date, value: Number(p.total) }));
  const reportRate =
    data && data.outletsExpected > 0
      ? Math.round((data.outletsReported / data.outletsExpected) * 100)
      : 0;

  const todayIdx = data ? trendData.findIndex((p) => p.date === data.date) : -1;
  const yesterdayValue =
    todayIdx > 0
      ? trendData[todayIdx - 1].value
      : trendData.length > 1
        ? trendData[trendData.length - 2].value
        : null;
  const todayValue = Number(data?.totalRevenueToday ?? 0);
  const revenueDelta =
    yesterdayValue != null && yesterdayValue > 0
      ? ((todayValue - yesterdayValue) / yesterdayValue) * 100
      : null;
  const sparkValues = trendData.map((p) => p.value);

  const companyColumns: Column<PerCompany>[] = [
    {
      key: 'name',
      header: t.domain.company,
      render: (c) => (
        <Link href={`/firmalar/${c.companyId}`} className="font-medium text-slate-800 hover:text-brand">
          {c.name}
        </Link>
      ),
    },
    { key: 'outlets', header: t.nav.outlets, align: 'right', render: (c) => formatNumber(c.outletCount) },
    {
      key: 'reported',
      header: t.status.received,
      align: 'right',
      render: (c) => <Badge tone={c.reported > 0 ? 'success' : 'neutral'}>{formatNumber(c.reported)}</Badge>,
    },
    {
      key: 'total',
      header: t.metrics.revenue,
      align: 'right',
      render: (c) => <span className="font-semibold text-slate-900">{formatMoney(c.totalToday)}</span>,
    },
  ];

  const activeCompanyName = companyId
    ? companiesQ.data?.find((c) => c.id === companyId)?.name
    : undefined;

  /* --------------------------------------------------- widget render --- */
  function renderWidget(id: DashboardWidgetId) {
    switch (id) {
      case 'kpis':
        return (
          <div key={id} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={`${t.metrics.revenue} (bugün)`}
              value={data ? formatMoney(data.totalRevenueToday) : '—'}
              sub={data ? formatDate(data.date, { day: '2-digit', month: 'long', year: 'numeric' }) : undefined}
              delta={revenueDelta}
              deltaLabel="düne göre"
              spark={sparkValues}
              tone="brand"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Raporlayan Şube"
              value={data ? `${data.outletsReported}/${data.outletsExpected}` : '—'}
              sub={data ? `%${reportRate} tamamlandı` : undefined}
              tone="success"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Onay Bekleyen"
              value={data ? formatNumber(data.pendingConfirmations) : '—'}
              sub={t.status.pending}
              tone="warning"
              loading={overview.isLoading}
            />
            <KpiCard
              label="Bugün Eksik"
              value={missing.data ? formatNumber(missing.data.length) : '—'}
              sub={t.status.missing}
              tone="danger"
              loading={missing.isLoading}
            />
          </div>
        );
      case 'trend':
        return (
          <Card key={id}>
            <CardHeader title={`${t.metrics.revenue} — son 14 gün`} subtitle="Onaylanmış toplam ciro trendi" />
            <CardBody>
              {overview.isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : trendData.length === 0 ? (
                <EmptyState title="Veri yok" description="Henüz ciro kaydı bulunmuyor." />
              ) : (
                <RevenueAreaChart data={trendData} />
              )}
            </CardBody>
          </Card>
        );
      case 'missing':
        return (
          <Card key={id}>
            <CardHeader
              title="Bugün Eksik"
              subtitle="Ciro bildirimi bekleyen şubeler"
              action={
                missing.data && missing.data.length > 0 ? (
                  <Badge tone="danger">{missing.data.length}</Badge>
                ) : undefined
              }
            />
            <CardBody className="pt-0">
              {missing.isLoading ? (
                <div className="space-y-2 pt-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !missing.data || missing.data.length === 0 ? (
                <EmptyState title="Eksik yok" description="Tüm şubeler bugün raporladı." />
              ) : (
                <ul className="max-h-[280px] space-y-2 overflow-y-auto pt-2 scrollbar-thin">
                  {missing.data.map((m) => (
                    <li
                      key={m.outletId}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/sube/${m.outletId}`}
                          className="block truncate text-sm font-medium text-slate-800 hover:text-brand"
                        >
                          {m.name}
                        </Link>
                        <p className="truncate text-xs text-slate-400">{m.company}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-mono text-slate-500">
                        {m.code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        );
      case 'perCompany':
        return (
          <Card key={id}>
            <CardHeader title={t.nav.companies} subtitle="Firma bazında bugünkü performans" />
            {overview.isLoading ? (
              <CardBody>
                <Skeleton className="h-40 w-full" />
              </CardBody>
            ) : (
              <DataTable
                columns={companyColumns}
                rows={data?.perCompany ?? []}
                getRowKey={(c) => c.companyId}
                empty="Firma bulunamadı."
              />
            )}
          </Card>
        );
      case 'studentVsRevenue':
        return <StudentVsRevenueWidget key={id} query={branches} />;
      case 'notifications':
        return <NotificationsWidget key={id} query={notifications} />;
      default:
        return null;
    }
  }

  // Group trend + missing into a two-thirds / one-third row when both are visible
  // and adjacent, matching the original layout; otherwise render full width.
  const visibleWidgets = config.widgets.filter((w) => w.visible).map((w) => w.id);

  return (
    <AppShell title={t.nav.overview} subtitle="Günlük ciro ve raporlama durumu">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeCompanyName && (
            <Badge tone="accent">Firma: {activeCompanyName}</Badge>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCustomizeOpen(true)}>
          <IconSliders width={16} height={16} />
          Özelleştir
        </Button>
      </div>

      {overview.isError ? (
        <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />
      ) : visibleWidgets.length === 0 ? (
        <EmptyState
          title="Tüm bileşenler gizli"
          description="Panele bileşen eklemek için Özelleştir'i açın."
          action={
            <Button size="sm" onClick={() => setCustomizeOpen(true)}>
              Özelleştir
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">{visibleWidgets.map((id) => renderWidget(id))}</div>
      )}

      <CustomizeDrawer
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        config={config}
        companies={companiesQ.data ?? []}
        onChange={setConfig}
        onSave={() => saveConfig.mutate(config)}
        saving={saveConfig.isPending}
      />
    </AppShell>
  );
}

/* ------------------------------------------- Student vs Revenue widget --- */
function StudentVsRevenueWidget({
  query,
}: {
  query: ReturnType<typeof useQuery<BranchReportRow[]>>;
}) {
  const rows = (query.data ?? []).slice(0, 6);
  return (
    <Card>
      <CardHeader
        title="Öğrenci ↔ Ciro"
        subtitle="En yüksek cirolu şubeler ve öğrenci sayıları"
      />
      {query.isLoading ? (
        <CardBody>
          <Skeleton className="h-40 w-full" />
        </CardBody>
      ) : rows.length === 0 ? (
        <CardBody>
          <EmptyState title="Veri yok" description="Şube verisi bulunamadı." />
        </CardBody>
      ) : (
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Şube',
              render: (r: BranchReportRow) => (
                <div>
                  <p className="font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.company}</p>
                </div>
              ),
            },
            {
              key: 'students',
              header: 'Öğrenci',
              align: 'right',
              render: (r: BranchReportRow) => (
                <span className="tabular-nums">
                  {formatNumber(r.studentTotal)}
                  <span className="ml-1 text-xs text-slate-400">
                    ({formatNumber(r.studentOrtaokul)}/{formatNumber(r.studentLise)})
                  </span>
                </span>
              ),
            },
            {
              key: 'revenue',
              header: 'Toplam Ciro',
              align: 'right',
              render: (r: BranchReportRow) => (
                <span className="font-semibold text-slate-900">{formatMoney(r.totalRevenue)}</span>
              ),
            },
            {
              key: 'avg',
              header: 'Günlük Ort.',
              align: 'right',
              render: (r: BranchReportRow) => formatMoney(r.avgDailyRevenue),
            },
          ]}
          rows={rows}
          getRowKey={(r) => r.outletId}
          empty="Kayıt yok."
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------- Notifications widget --- */
function NotificationsWidget({
  query,
}: {
  query: ReturnType<typeof useQuery<NotificationItem[]>>;
}) {
  const rows = (query.data ?? []).slice(0, 5);
  return (
    <Card>
      <CardHeader
        title="Son Bildirimler"
        subtitle="En son uyarılar"
        action={
          <Link href="/bildirimler" className="text-xs font-medium text-brand hover:underline">
            Tümü
          </Link>
        }
      />
      <CardBody className="pt-0">
        {query.isLoading ? (
          <div className="space-y-2 pt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Bildirim yok" description="Henüz bildirim bulunmuyor." />
        ) : (
          <ul className="divide-y divide-slate-50 pt-1">
            {rows.map((n) => (
              <li key={n.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.body}</p>
                <span className="mt-1 inline-block rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 ring-1 ring-slate-200/60">
                  {notificationEventLabel(n.event)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------- Customize drawer --- */
function CustomizeDrawer({
  open,
  onClose,
  config,
  companies,
  onChange,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  config: DashboardConfig;
  companies: Company[];
  onChange: (next: DashboardConfig) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const meta = useMemo(() => new Map(WIDGET_META.map((w) => [w.id, w])), []);

  function move(index: number, dir: -1 | 1) {
    const widgets = [...config.widgets];
    const target = index + dir;
    if (target < 0 || target >= widgets.length) return;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    onChange({ ...config, widgets });
  }

  function toggle(id: DashboardWidgetId, visible: boolean) {
    onChange({
      ...config,
      widgets: config.widgets.map((w) => (w.id === id ? { ...w, visible } : w)),
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Paneli Özelleştir"
      subtitle="Bileşenleri göster/gizle, sırala ve firma filtresini seç"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSave} loading={saving}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-1.5 block text-sm font-medium text-slate-700">Firma filtresi</p>
          <Select
            value={config.companyId ?? ''}
            onChange={(e) => onChange({ ...config, companyId: e.target.value })}
          >
            <option value="">Tüm firmalar</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-400">
            Seçilen firma özet, trend, tablo ve öğrenci/ciro bileşenlerine uygulanır.
          </p>
        </div>

        <div>
          <p className="mb-2 block text-sm font-medium text-slate-700">Bileşenler</p>
          <ul className="space-y-2">
            {config.widgets.map((w, i) => {
              const m = meta.get(w.id);
              if (!m) return null;
              return (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Yukarı taşı"
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    >
                      <IconArrowUp width={14} height={14} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === config.widgets.length - 1}
                      aria-label="Aşağı taşı"
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    >
                      <IconArrowDown width={14} height={14} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{m.label}</p>
                    <p className="truncate text-xs text-slate-400">{m.description}</p>
                  </div>
                  <Switch checked={w.visible} onChange={(v) => toggle(w.id, v)} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}
