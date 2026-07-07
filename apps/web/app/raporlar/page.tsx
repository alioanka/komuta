'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { KpiCard } from '@/components/KpiCard';
import { ReportBarChart } from '@/components/Charts';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Select,
  Input,
  Skeleton,
  cn,
} from '@/components/ui';
import { IconDownload } from '@/components/icons';
import { formatMoney, formatNumber } from '@/lib/format';
import { OUTLET_TYPE_OPTIONS, outletTypeLabel } from '@/lib/labels';
import { exportRows, timestampedName } from '@/lib/xlsx';
import type {
  BranchReportRow,
  Company,
  Outlet,
  ReportRevenueResponse,
  ReportRevenueRow,
} from '@/lib/types';

type GroupBy = 'day' | 'month' | 'outlet' | 'company' | 'brand';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Gün' },
  { value: 'month', label: 'Ay' },
  { value: 'outlet', label: 'Şube' },
  { value: 'company', label: 'Firma' },
  { value: 'brand', label: 'Marka' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'CONFIRMED', label: 'Onaylandı' },
  { value: 'PENDING_REVIEW', label: 'Onay Bekliyor' },
];

/** Default date range: the last 30 days. */
function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export default function ReportsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'revenue' | 'branches'>('revenue');

  const companiesQ = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });
  const outletsQ = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  return (
    <AppShell title="Raporlar" subtitle="Ciro ve şube performans raporları">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
          {[
            { key: 'revenue' as const, label: 'Ciro Raporu' },
            { key: 'branches' as const, label: 'Şube Karşılaştırma' },
          ].map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                tab === tb.key ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'revenue' ? (
          <RevenueReport
            companies={companiesQ.data ?? []}
            outlets={outletsQ.data ?? []}
            t={t}
          />
        ) : (
          <BranchReport companies={companiesQ.data ?? []} t={t} />
        )}
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------ Revenue report --- */
function RevenueReport({
  companies,
  outlets,
  t,
}: {
  companies: Company[];
  outlets: Outlet[];
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [companyId, setCompanyId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  const outletOptions = useMemo(
    () => (companyId ? outlets.filter((o) => o.companyId === companyId) : outlets),
    [outlets, companyId],
  );

  const query = qs({ companyId, outletId, type, from, to, status, groupBy });
  const report = useQuery({
    queryKey: ['reports', 'revenue', query],
    queryFn: () => apiFetch<ReportRevenueResponse>(`/reports/revenue${query}`),
  });

  const rows = report.data?.rows ?? [];
  const chartData = rows.slice(0, 60).map((r) => ({ label: r.label, value: Number(r.total) }));

  const columns: Column<ReportRevenueRow>[] = [
    { key: 'label', header: 'Grup', render: (r) => <span className="font-medium text-slate-800">{r.label}</span> },
    {
      key: 'total',
      header: 'Toplam Ciro',
      align: 'right',
      render: (r) => <span className="font-semibold text-slate-900">{formatMoney(r.total)}</span>,
    },
    { key: 'count', header: 'Kayıt', align: 'right', render: (r) => formatNumber(r.count) },
    { key: 'avg', header: 'Ortalama', align: 'right', render: (r) => formatMoney(r.avg) },
  ];

  function handleExport() {
    const groupLabel = GROUP_OPTIONS.find((g) => g.value === groupBy)?.label ?? 'Grup';
    exportRows(
      rows.map((r) => ({
        [groupLabel]: r.label,
        'Toplam Ciro (TL)': Number(r.total),
        'Kayıt Sayısı': r.count,
        'Ortalama (TL)': Number(r.avg),
      })),
      timestampedName('komuta-ciro-raporu'),
      'Ciro Raporu',
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t.domain.company}>
            <Select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setOutletId('');
              }}
            >
              <option value="">Tüm firmalar</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.domain.outlet}>
            <Select value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              <option value="">Tüm şubeler</option>
              {outletOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tür">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tüm türler</option>
              {OUTLET_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gruplama">
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
          </Field>
          <Field label="Bitiş">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
          </Field>
          <Field label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleExport}
              disabled={rows.length === 0}
            >
              <IconDownload width={16} height={16} />
              Excel indir
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Toplam Ciro"
          value={report.data ? formatMoney(report.data.totalSum) : '—'}
          tone="brand"
          loading={report.isLoading}
        />
        <KpiCard
          label="Kayıt Sayısı"
          value={report.data ? formatNumber(report.data.totalCount) : '—'}
          tone="accent"
          loading={report.isLoading}
        />
      </div>

      {report.isError ? (
        <ErrorState message={(report.error as ApiError).message} onRetry={() => report.refetch()} />
      ) : (
        <>
          <Card>
            <CardHeader title="Ciro Dağılımı" subtitle="Seçili gruplamaya göre toplam ciro" />
            <CardBody>
              {report.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length === 0 ? (
                <EmptyState title="Veri yok" description="Seçilen filtrelerle kayıt bulunamadı." />
              ) : (
                <ReportBarChart data={chartData} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rapor Tablosu" subtitle={`${rows.length} satır`} />
            {report.isLoading ? (
              <CardBody>
                <Skeleton className="h-40 w-full" />
              </CardBody>
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                getRowKey={(r) => r.key}
                empty="Kayıt bulunamadı."
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Branch report --- */
function BranchReport({
  companies,
  t,
}: {
  companies: Company[];
  t: ReturnType<typeof useI18n>['t'];
}) {
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());

  const query = qs({ companyId, from, to });
  const report = useQuery({
    queryKey: ['reports', 'branches', query],
    queryFn: () => apiFetch<BranchReportRow[]>(`/reports/branches${query}`),
  });

  const rows = report.data ?? [];

  const columns: Column<BranchReportRow>[] = [
    {
      key: 'name',
      header: t.domain.outlet,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-400">{r.company}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Tür', render: (r) => outletTypeLabel(r.type, t) },
    { key: 'orta', header: 'Ortaokul', align: 'right', render: (r) => formatNumber(r.studentOrtaokul) },
    { key: 'lise', header: 'Lise', align: 'right', render: (r) => formatNumber(r.studentLise) },
    {
      key: 'total',
      header: 'Öğrenci',
      align: 'right',
      render: (r) => <span className="font-medium">{formatNumber(r.studentTotal)}</span>,
    },
    {
      key: 'revenue',
      header: 'Toplam Ciro',
      align: 'right',
      render: (r) => <span className="font-semibold text-slate-900">{formatMoney(r.totalRevenue)}</span>,
    },
    {
      key: 'avg',
      header: 'Günlük Ort.',
      align: 'right',
      render: (r) => formatMoney(r.avgDailyRevenue),
    },
  ];

  function handleExport() {
    exportRows(
      rows.map((r) => ({
        Şube: r.name,
        Kod: r.code,
        Firma: r.company,
        Marka: r.brand ?? '',
        Tür: outletTypeLabel(r.type, t),
        'Ortaokul Öğrenci': r.studentOrtaokul,
        'Lise Öğrenci': r.studentLise,
        'Toplam Öğrenci': r.studentTotal,
        'Toplam Ciro (TL)': Number(r.totalRevenue),
        'Gün Sayısı': r.dayCount,
        'Günlük Ortalama (TL)': Number(r.avgDailyRevenue),
      })),
      timestampedName('komuta-sube-karsilastirma'),
      'Şube Karşılaştırma',
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t.domain.company}>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Tüm firmalar</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
          </Field>
          <Field label="Bitiş">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleExport}
              disabled={rows.length === 0}
            >
              <IconDownload width={16} height={16} />
              Excel indir
            </Button>
          </div>
        </CardBody>
      </Card>

      {report.isError ? (
        <ErrorState message={(report.error as ApiError).message} onRetry={() => report.refetch()} />
      ) : (
        <Card>
          <CardHeader
            title="Şube Karşılaştırma"
            subtitle="Öğrenci sayıları ve ciro performansı (cirosu en yüksek şubeler)"
          />
          {report.isLoading ? (
            <CardBody>
              <Skeleton className="h-40 w-full" />
            </CardBody>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(r) => r.outletId}
              empty="Kayıt bulunamadı."
            />
          )}
        </Card>
      )}
    </div>
  );
}
