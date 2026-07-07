'use client';

/**
 * Outlet ("şube") settings tab: edit fields, aliases, employees, WhatsApp
 * number bindings, and a danger zone. Self-contained — owns its own queries.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Skeleton } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/overlay';
import { OutletFormModal } from './OutletFormModal';
import { MappingFormModal } from './MappingFormModal';
import { outletTypeLabel, mappingStatusLabel, mappingStatusTone } from '@/lib/labels';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Company, Employee, Outlet, PhoneMapping } from '@/lib/types';

export function OutletSettingsTab({ outletId }: { outletId: string }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const router = useRouter();
  const canEdit = can('outlet:update');
  const canDelete = can('outlet:delete');
  const canAlias = can('alias:write');
  const canEmployee = can('employee:write');
  const canMap = can('mapping:approve');

  const outletQ = useQuery({
    queryKey: ['outlet-settings', outletId],
    queryFn: () => apiFetch<Outlet>(`/outlets/${outletId}`),
  });
  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => apiFetch<Company[]>('/companies') });
  const employeesQ = useQuery({
    queryKey: ['employees', outletId],
    queryFn: () => apiFetch<Employee[]>(`/employees?outletId=${outletId}`),
  });
  const mappingsQ = useQuery({ queryKey: ['mappings', 'all'], queryFn: () => apiFetch<PhoneMapping[]>('/mappings') });

  const outlet = outletQ.data;
  const mappings = useMemo(
    () => (mappingsQ.data ?? []).filter((m) => m.outletId === outletId),
    [mappingsQ.data, outletId],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newEmployee, setNewEmployee] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [deleteOutlet, setDeleteOutlet] = useState(false);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  const err = (e: unknown) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message });

  const addAlias = useMutation({
    mutationFn: () => apiFetch('/outlets/alias', { method: 'POST', body: { outletId, alias: newAlias.trim() } }),
    onSuccess: () => { setNewAlias(''); push({ tone: 'success', title: 'Takma ad eklendi' }); void qc.invalidateQueries({ queryKey: ['outlet-settings', outletId] }); },
    onError: err,
  });
  const delAlias = useMutation({
    mutationFn: (id: string) => apiFetch(`/outlets/alias/${id}`, { method: 'DELETE' }),
    onSuccess: () => { push({ tone: 'success', title: 'Takma ad silindi' }); void qc.invalidateQueries({ queryKey: ['outlet-settings', outletId] }); },
    onError: err,
  });
  const addEmp = useMutation({
    mutationFn: () => apiFetch('/employees', { method: 'POST', body: { fullName: newEmployee.trim(), outletId } }),
    onSuccess: () => { setNewEmployee(''); push({ tone: 'success', title: 'Çalışan eklendi' }); void qc.invalidateQueries({ queryKey: ['employees', outletId] }); },
    onError: err,
  });
  const delEmp = useMutation({
    mutationFn: (id: string) => apiFetch(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setDeleteEmp(null); push({ tone: 'success', title: 'Çalışan silindi' }); void qc.invalidateQueries({ queryKey: ['employees', outletId] }); },
    onError: (e) => { setDeleteEmp(null); err(e); },
  });
  const unlinkMap = useMutation({
    mutationFn: (id: string) => apiFetch(`/mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => { push({ tone: 'success', title: 'Numara kaldırıldı' }); void qc.invalidateQueries({ queryKey: ['mappings'] }); },
    onError: err,
  });
  const removeOutlet = useMutation({
    mutationFn: () => apiFetch<{ soft?: boolean }>(`/outlets/${outletId}`, { method: 'DELETE' }),
    onSuccess: (res) => {
      push({
        tone: 'success',
        title: res?.soft ? 'Şube devre dışı bırakıldı' : 'Şube silindi',
        body: res?.soft ? 'Geçmiş veriler korundu.' : undefined,
      });
      void qc.invalidateQueries({ queryKey: ['outlets'] });
      router.push('/sube');
    },
    onError: (e) => { setDeleteOutlet(false); err(e); },
  });

  if (outletQ.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!outlet) return <p className="text-sm text-slate-500">{t.errors.notFound}</p>;

  return (
    <div className="space-y-6">
      {/* Fields */}
      <Card>
        <CardHeader
          title="Şube Bilgileri"
          subtitle="Ad, kod, tür ve diğer ayarlar"
          action={canEdit ? <Button size="sm" onClick={() => setEditOpen(true)}>Düzenle</Button> : undefined}
        />
        <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Info label="Ad" value={outlet.name} />
          <Info label="Kod" value={outlet.code} mono />
          <Info label="Tür" value={outletTypeLabel(outlet.type, t)} />
          <Info label="Marka" value={outlet.brand?.name ?? '—'} />
          <Info label="Şehir" value={outlet.city ?? '—'} />
          <Info label="Durum" value={outlet.isActive ? 'Aktif' : 'Pasif'} />
          <Info label="Günlük ciro" value={outlet.expectsDailyRevenue ? 'Beklenir' : 'Beklenmez'} />
          <Info
            label="Ortaokul Öğrenci"
            value={outlet.studentOrtaokul != null ? String(outlet.studentOrtaokul) : '—'}
          />
          <Info
            label="Lise Öğrenci"
            value={outlet.studentLise != null ? String(outlet.studentLise) : '—'}
          />
        </CardBody>
      </Card>

      {/* Aliases */}
      <Card>
        <CardHeader title="Takma Adlar" subtitle="Çalışanların mesajda yazabileceği alternatif isimler" />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {outlet.aliases.length === 0 && <span className="text-sm text-slate-400">Henüz takma ad yok.</span>}
            {outlet.aliases.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {a.alias}
                {canAlias && (
                  <button className="text-slate-400 hover:text-red-500" onClick={() => delAlias.mutate(a.id)} aria-label="Sil">×</button>
                )}
              </span>
            ))}
          </div>
          {canAlias && (
            <div className="flex gap-2">
              <Input className="max-w-xs" placeholder="Yeni takma ad" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
              <Button size="sm" variant="secondary" disabled={!newAlias.trim()} loading={addAlias.isPending} onClick={() => addAlias.mutate()}>Ekle</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Employees */}
      <Card>
        <CardHeader title="Çalışanlar" subtitle="Bu şubede ciro gönderebilecek kişiler" />
        <CardBody className="space-y-3">
          {employeesQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (employeesQ.data ?? []).length === 0 ? (
            <span className="text-sm text-slate-400">Henüz çalışan yok.</span>
          ) : (
            <ul className="divide-y divide-slate-50">
              {(employeesQ.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">{e.fullName}</span>
                  {canEmployee && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleteEmp(e)}>Sil</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEmployee && (
            <div className="flex gap-2">
              <Input className="max-w-xs" placeholder="Ad soyad" value={newEmployee} onChange={(e) => setNewEmployee(e.target.value)} />
              <Button size="sm" variant="secondary" disabled={!newEmployee.trim()} loading={addEmp.isPending} onClick={() => addEmp.mutate()}>Ekle</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* WhatsApp numbers */}
      <Card>
        <CardHeader
          title="WhatsApp Numaraları"
          subtitle="Bu şubeye ciro gönderen numaralar"
          action={canMap ? <Button size="sm" onClick={() => setMapOpen(true)}>Numara Bağla</Button> : undefined}
        />
        <CardBody className="space-y-2">
          {mappings.length === 0 ? (
            <span className="text-sm text-slate-400">Bağlı numara yok.</span>
          ) : (
            <ul className="divide-y divide-slate-50">
              {mappings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-mono text-slate-700">{formatPhone(m.phoneE164)}</span>
                  <span className="flex items-center gap-3">
                    {m.employee && <span className="text-slate-500">{m.employee.fullName}</span>}
                    <Badge tone={mappingStatusTone(m.status)}>{mappingStatusLabel(m.status)}</Badge>
                    {canMap && <Button size="sm" variant="ghost" onClick={() => unlinkMap.mutate(m.id)}>Kaldır</Button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Danger zone */}
      {canDelete && (
        <Card className="border-red-100">
          <CardHeader title="Tehlikeli Bölge" subtitle="Şubeyi devre dışı bırak veya sil" />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Ciro/muhasebe verisi olan şubeler silinmez, pasife alınır (geçmiş korunur).
            </p>
            <Button variant="danger" onClick={() => setDeleteOutlet(true)}>Şubeyi Sil</Button>
          </CardBody>
        </Card>
      )}

      {companiesQ.data && (
        <OutletFormModal open={editOpen} onClose={() => setEditOpen(false)} outlet={outlet} companies={companiesQ.data} />
      )}
      <MappingFormModal open={mapOpen} onClose={() => setMapOpen(false)} outlets={outlet ? [outlet] : []} lockOutletId={outletId} />

      <ConfirmDialog
        open={!!deleteEmp}
        onClose={() => setDeleteEmp(null)}
        onConfirm={() => deleteEmp && delEmp.mutate(deleteEmp.id)}
        loading={delEmp.isPending}
        title="Çalışanı sil"
        confirmLabel="Sil"
        message={`${deleteEmp?.fullName ?? ''} silinsin mi?`}
      />
      <ConfirmDialog
        open={deleteOutlet}
        onClose={() => setDeleteOutlet(false)}
        onConfirm={() => removeOutlet.mutate()}
        loading={removeOutlet.isPending}
        title="Şubeyi sil"
        confirmLabel="Sil"
        message={`${outlet.name} silinsin mi? Verisi varsa pasife alınır ve geçmiş korunur.`}
      />
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={mono ? 'font-mono text-slate-800' : 'text-slate-800'}>{value}</p>
    </div>
  );
}
