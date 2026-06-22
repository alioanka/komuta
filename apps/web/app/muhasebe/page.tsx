'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Button, Card, CardBody, CardHeader, Field, Input, Select, cn } from '@/components/ui';
import type { Outlet } from '@/lib/types';

type FormKey = 'payroll' | 'purchases' | 'inventory' | 'student' | 'headcount';

const TABS: { key: FormKey; label: string }[] = [
  { key: 'payroll', label: 'Personel Maaşı' },
  { key: 'purchases', label: 'Mal Alımı' },
  { key: 'inventory', label: 'Stok' },
  { key: 'student', label: 'Öğrenci Sayısı' },
  { key: 'headcount', label: 'Çalışan Sayısı' },
];

const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

function useSubmit(path: string) {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(path, { method: 'POST', body }),
  });
}

export default function AccountingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<FormKey>('payroll');

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
  });

  const outletOptions = outlets.data ?? [];

  return (
    <AppShell title={t.nav.accounting}>
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
          {TABS.map((tb) => (
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

        {tab === 'payroll' && <PayrollForm outlets={outletOptions} />}
        {tab === 'purchases' && <PurchasesForm outlets={outletOptions} />}
        {tab === 'inventory' && <InventoryForm outlets={outletOptions} />}
        {tab === 'student' && <StudentForm outlets={outletOptions} />}
        {tab === 'headcount' && <HeadcountForm outlets={outletOptions} />}
      </div>
    </AppShell>
  );
}

function OutletField({
  value,
  onChange,
  outlets,
}: {
  value: string;
  onChange: (v: string) => void;
  outlets: Outlet[];
}) {
  return (
    <Field label="Şube">
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Şube seçin…</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.code})
          </option>
        ))}
      </Select>
    </Field>
  );
}

function FormShell({
  title,
  subtitle,
  onSubmit,
  pending,
  success,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  onSubmit: (e: React.FormEvent) => void;
  pending: boolean;
  success: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader title={title} subtitle={subtitle} />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" loading={pending}>
              Kaydet
            </Button>
            {success && <span className="text-sm font-medium text-brand-success">Kaydedildi ✓</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function PayrollForm({ outlets }: { outlets: Outlet[] }) {
  const m = useSubmit('/accounting/payroll');
  const [outletId, setOutletId] = useState('');
  const [periodMonth, setPeriod] = useState(thisMonth());
  const [totalSalary, setSalary] = useState('');
  const [employeeCount, setCount] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    m.mutate({
      outletId,
      periodMonth,
      totalSalary,
      ...(employeeCount ? { employeeCount: Number(employeeCount) } : {}),
    });
  }

  return (
    <FormShell
      title="Personel Maaşı"
      subtitle="Aylık toplam maaş gideri"
      onSubmit={submit}
      pending={m.isPending}
      success={m.isSuccess}
      error={m.isError ? (m.error as Error).message : null}
    >
      <OutletField value={outletId} onChange={setOutletId} outlets={outlets} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dönem (Ay)">
          <Input type="month" value={periodMonth} onChange={(e) => setPeriod(e.target.value)} required />
        </Field>
        <Field label="Toplam Maaş (TL)" hint="Örn: 125000.00">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={totalSalary}
            onChange={(e) => setSalary(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Çalışan Sayısı (opsiyonel)">
        <Input
          type="number"
          min={0}
          value={employeeCount}
          onChange={(e) => setCount(e.target.value)}
        />
      </Field>
    </FormShell>
  );
}

function PurchasesForm({ outlets }: { outlets: Outlet[] }) {
  const m = useSubmit('/accounting/purchases');
  const [outletId, setOutletId] = useState('');
  const [periodMonth, setPeriod] = useState(thisMonth());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    m.mutate({ outletId, periodMonth, amount, ...(note ? { note } : {}) });
  }

  return (
    <FormShell
      title="Mal Alımı"
      subtitle="Aylık mal alım tutarı"
      onSubmit={submit}
      pending={m.isPending}
      success={m.isSuccess}
      error={m.isError ? (m.error as Error).message : null}
    >
      <OutletField value={outletId} onChange={setOutletId} outlets={outlets} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dönem (Ay)">
          <Input type="month" value={periodMonth} onChange={(e) => setPeriod(e.target.value)} required />
        </Field>
        <Field label="Tutar (TL)" hint="Örn: 48250.00">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Not (opsiyonel)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormShell>
  );
}

function InventoryForm({ outlets }: { outlets: Outlet[] }) {
  const m = useSubmit('/accounting/inventory');
  const [outletId, setOutletId] = useState('');
  const [asOfDate, setDate] = useState(today());
  const [stockValue, setStock] = useState('');
  const [note, setNote] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    m.mutate({ outletId, asOfDate, stockValue, ...(note ? { note } : {}) });
  }

  return (
    <FormShell
      title="Stok"
      subtitle="Belirli tarihteki stok değeri"
      onSubmit={submit}
      pending={m.isPending}
      success={m.isSuccess}
      error={m.isError ? (m.error as Error).message : null}
    >
      <OutletField value={outletId} onChange={setOutletId} outlets={outlets} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tarih">
          <Input type="date" value={asOfDate} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Stok Değeri (TL)" hint="Örn: 32000.00">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={stockValue}
            onChange={(e) => setStock(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Not (opsiyonel)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormShell>
  );
}

function StudentForm({ outlets }: { outlets: Outlet[] }) {
  const m = useSubmit('/accounting/student-count');
  const [outletId, setOutletId] = useState('');
  const [periodMonth, setPeriod] = useState(thisMonth());
  const [ortaokul, setOrta] = useState('');
  const [lise, setLise] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    m.mutate({ outletId, periodMonth, ortaokul: Number(ortaokul), lise: Number(lise) });
  }

  return (
    <FormShell
      title="Öğrenci Sayısı"
      subtitle="Ortaokul ve Lise öğrenci sayıları"
      onSubmit={submit}
      pending={m.isPending}
      success={m.isSuccess}
      error={m.isError ? (m.error as Error).message : null}
    >
      <OutletField value={outletId} onChange={setOutletId} outlets={outlets} />
      <Field label="Dönem (Ay)">
        <Input type="month" value={periodMonth} onChange={(e) => setPeriod(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ortaokul">
          <Input type="number" min={0} value={ortaokul} onChange={(e) => setOrta(e.target.value)} required />
        </Field>
        <Field label="Lise">
          <Input type="number" min={0} value={lise} onChange={(e) => setLise(e.target.value)} required />
        </Field>
      </div>
    </FormShell>
  );
}

function HeadcountForm({ outlets }: { outlets: Outlet[] }) {
  const m = useSubmit('/accounting/headcount');
  const [outletId, setOutletId] = useState('');
  const [periodMonth, setPeriod] = useState(thisMonth());
  const [employeeCount, setCount] = useState('');
  const [reason, setReason] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    m.mutate({ outletId, periodMonth, employeeCount: Number(employeeCount), ...(reason ? { reason } : {}) });
  }

  return (
    <FormShell
      title="Çalışan Sayısı"
      subtitle="Aylık çalışan sayısı düzeltmesi"
      onSubmit={submit}
      pending={m.isPending}
      success={m.isSuccess}
      error={m.isError ? (m.error as Error).message : null}
    >
      <OutletField value={outletId} onChange={setOutletId} outlets={outlets} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dönem (Ay)">
          <Input type="month" value={periodMonth} onChange={(e) => setPeriod(e.target.value)} required />
        </Field>
        <Field label="Çalışan Sayısı">
          <Input
            type="number"
            min={0}
            value={employeeCount}
            onChange={(e) => setCount(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Açıklama (opsiyonel)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </FormShell>
  );
}
