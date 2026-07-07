'use client';

export const dynamic = 'force-dynamic';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { IconDownload, IconImport } from '@/components/icons';
import { formatMoney, formatNumber } from '@/lib/format';
import {
  parseWorkbook,
  downloadImportTemplate,
  type ParsedImportRow,
  type ParseResult,
} from '@/lib/xlsx';
import type { RevenueImportResult } from '@/lib/types';

const PREVIEW_LIMIT = 50;

export default function ImportPage() {
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [result, setResult] = useState<RevenueImportResult | null>(null);

  const validRows = parsed ? parsed.rows.filter((r) => r.warnings.length === 0) : [];
  const warnRows = parsed ? parsed.rows.filter((r) => r.warnings.length > 0) : [];

  async function onFile(file: File) {
    setResult(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const res = await parseWorkbook(file);
      setParsed(res);
      if (res.rows.length === 0) {
        push({ tone: 'danger', title: 'Boş dosya', body: 'Dosyada satır bulunamadı.' });
      } else if (!res.detected.date || !res.detected.code || !res.detected.amount) {
        push({
          tone: 'info',
          title: 'Sütunlar kısmen tanındı',
          body: 'Tarih, Mağaza Kodu ve Ciro sütun başlıklarını kontrol edin.',
        });
      }
    } catch (e) {
      setParsed(null);
      push({ tone: 'danger', title: 'Dosya okunamadı', body: (e as Error).message });
    } finally {
      setParsing(false);
    }
  }

  const importMut = useMutation({
    mutationFn: () =>
      apiFetch<RevenueImportResult>('/revenue/import', {
        method: 'POST',
        body: {
          rows: validRows.map((r) => ({ date: r.date, storeCode: r.storeCode, amount: r.amount })),
          defaultStatus: 'CONFIRMED',
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      push({
        tone: res.errors.length > 0 ? 'info' : 'success',
        title: 'İçeri aktarma tamamlandı',
        body: `${res.imported} kayıt eklendi, ${res.skipped} atlandı.`,
      });
    },
    onError: (e) => push({ tone: 'danger', title: 'İçeri aktarma başarısız', body: (e as ApiError).message }),
  });

  function reset() {
    setParsed(null);
    setResult(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const previewColumns: Column<ParsedImportRow & { _i: number }>[] = [
    { key: 'row', header: '#', render: (r) => <span className="text-slate-400">{r._i + 1}</span> },
    { key: 'date', header: 'Tarih', render: (r) => r.date || <span className="text-red-500">—</span> },
    {
      key: 'code',
      header: 'Mağaza Kodu',
      render: (r) =>
        r.storeCode ? (
          <span className="font-mono text-slate-700">{r.storeCode}</span>
        ) : (
          <span className="text-red-500">—</span>
        ),
    },
    {
      key: 'amount',
      header: 'Ciro',
      align: 'right',
      render: (r) => (r.amount ? formatMoney(r.amount) : <span className="text-red-500">—</span>),
    },
    {
      key: 'warn',
      header: 'Durum',
      render: (r) =>
        r.warnings.length === 0 ? (
          <Badge tone="success">Hazır</Badge>
        ) : (
          <Badge tone="warning">{r.warnings.join(', ')}</Badge>
        ),
    },
  ];

  const preview = (parsed?.rows ?? [])
    .slice(0, PREVIEW_LIMIT)
    .map((r, i) => ({ ...r, _i: i }));

  const errorColumns: Column<RevenueImportResult['errors'][number]>[] = [
    { key: 'row', header: 'Satır', render: (e) => e.row },
    { key: 'code', header: 'Mağaza Kodu', render: (e) => <span className="font-mono">{e.storeCode}</span> },
    { key: 'reason', header: 'Neden', render: (e) => <span className="text-red-600">{e.reason}</span> },
  ];

  return (
    <AppShell title="İçeri Aktar" subtitle="Excel / CSV ile toplu ciro yükleme">
      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Dosya Yükle"
            subtitle="Tarih, Mağaza Kodu ve Ciro sütunlarını içeren .xlsx, .xls veya .csv dosyası"
            action={
              <Button variant="secondary" size="sm" onClick={downloadImportTemplate}>
                <IconDownload width={16} height={16} />
                Örnek şablon indir
              </Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
                className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1b3375]"
              />
              {parsed && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Temizle
                </Button>
              )}
            </div>
            {fileName && (
              <p className="text-xs text-slate-500">
                Dosya: <span className="font-medium text-slate-700">{fileName}</span>
              </p>
            )}
          </CardBody>
        </Card>

        {parsing && <Skeleton className="h-40 w-full rounded-2xl" />}

        {parsed && !parsing && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Toplam Satır" value={formatNumber(parsed.rows.length)} tone="brand" />
              <KpiCard label="Aktarılabilir" value={formatNumber(validRows.length)} tone="success" />
              <KpiCard label="Uyarılı Satır" value={formatNumber(warnRows.length)} tone="warning" />
            </div>

            <Card>
              <CardHeader
                title="Önizleme"
                subtitle={`İlk ${Math.min(PREVIEW_LIMIT, parsed.rows.length)} satır gösteriliyor`}
                action={
                  <Button
                    onClick={() => importMut.mutate()}
                    loading={importMut.isPending}
                    disabled={validRows.length === 0}
                  >
                    <IconImport width={16} height={16} />
                    İçeri Aktar ({validRows.length})
                  </Button>
                }
              />
              {parsed.rows.length === 0 ? (
                <CardBody>
                  <EmptyState title="Veri yok" description="Dosyada geçerli satır bulunamadı." />
                </CardBody>
              ) : (
                <DataTable
                  columns={previewColumns}
                  rows={preview}
                  getRowKey={(r) => String(r._i)}
                  empty="Satır yok."
                />
              )}
            </Card>
          </>
        )}

        {result && (
          <Card>
            <CardHeader title="Sonuç" subtitle="İçeri aktarma özeti" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Badge tone="success">{result.imported} eklendi</Badge>
                <Badge tone="neutral">{result.skipped} atlandı</Badge>
                {result.errors.length > 0 && <Badge tone="danger">{result.errors.length} hata</Badge>}
              </div>
              {result.errors.length > 0 && (
                <DataTable
                  columns={errorColumns}
                  rows={result.errors}
                  getRowKey={(e) => `${e.row}-${e.storeCode}`}
                  empty="Hata yok."
                />
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
