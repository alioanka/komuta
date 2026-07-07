'use client';

/**
 * Create / edit outlet (şube) modal — shared by the company detail page,
 * the outlet list and the outlet settings drawer.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OutletType } from '@komuta/shared';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/ui/overlay';
import { Button, Field, FieldError, Input, Select, Switch } from '@/components/ui';
import { OUTLET_TYPE_OPTIONS } from '@/lib/labels';
import { MSG } from '@/lib/validate';
import type { Company, Outlet } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode; absent → create mode. */
  outlet?: Outlet | null;
  companies: Company[];
  /** Preselect (and lock) the company — used from the company detail page. */
  defaultCompanyId?: string;
}

interface FormErrors {
  companyId?: string;
  name?: string;
  code?: string;
}

export function OutletFormModal({ open, onClose, outlet, companies, defaultCompanyId }: Props) {
  const qc = useQueryClient();
  const { push } = useToast();
  const isEdit = !!outlet;

  const [companyId, setCompanyId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<OutletType>('SCHOOL_CANTEEN');
  const [city, setCity] = useState('');
  const [campus, setCampus] = useState('');
  const [expectsDailyRevenue, setExpectsDailyRevenue] = useState(true);
  const [studentOrtaokul, setStudentOrtaokul] = useState('');
  const [studentLise, setStudentLise] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (outlet) {
      setCompanyId(outlet.companyId);
      setBrandId(outlet.brandId ?? '');
      setName(outlet.name);
      setCode(outlet.code);
      setType(outlet.type);
      setCity(outlet.city ?? '');
      setCampus(outlet.campus ?? '');
      setExpectsDailyRevenue(outlet.expectsDailyRevenue);
      setStudentOrtaokul(outlet.studentOrtaokul != null ? String(outlet.studentOrtaokul) : '');
      setStudentLise(outlet.studentLise != null ? String(outlet.studentLise) : '');
    } else {
      setCompanyId(defaultCompanyId ?? companies[0]?.id ?? '');
      setBrandId('');
      setName('');
      setCode('');
      setType('SCHOOL_CANTEEN');
      setCity('');
      setCampus('');
      setExpectsDailyRevenue(true);
      setStudentOrtaokul('');
      setStudentLise('');
    }
  }, [open, outlet, defaultCompanyId, companies]);

  const brands = useMemo(
    () => companies.find((c) => c.id === companyId)?.brands ?? [],
    [companies, companyId],
  );

  function validate(): boolean {
    const next: FormErrors = {};
    if (!companyId) next.companyId = MSG.required;
    if (!name.trim()) next.name = MSG.required;
    if (!code.trim()) next.code = MSG.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        companyId,
        brandId: brandId || null,
        name: name.trim(),
        code: code.trim(),
        type,
        city: city.trim() || null,
        campus: campus.trim() || null,
        expectsDailyRevenue,
        studentOrtaokul: studentOrtaokul.trim() === '' ? null : Number(studentOrtaokul),
        studentLise: studentLise.trim() === '' ? null : Number(studentLise),
      };
      if (isEdit && outlet) {
        // companyId is immutable after creation — don't send it on PATCH.
        const { companyId: _omit, ...patch } = body;
        return apiFetch(`/outlets/${outlet.id}`, { method: 'PATCH', body: patch });
      }
      return apiFetch('/outlets', { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['outlets'] });
      void qc.invalidateQueries({ queryKey: ['companies'] });
      if (outlet) void qc.invalidateQueries({ queryKey: ['outlet', outlet.id] });
      push({
        tone: 'success',
        title: isEdit ? 'Şube güncellendi' : 'Şube oluşturuldu',
        body: name.trim(),
      });
      onClose();
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  function submit() {
    if (!validate()) return;
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Şubeyi Düzenle' : 'Yeni Şube'}
      subtitle={isEdit ? outlet?.name : 'Yeni bir şube (kantin, yemekhane, kafe…) tanımlayın'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Firma">
            <Select
              value={companyId}
              disabled={isEdit || !!defaultCompanyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setBrandId('');
              }}
            >
              <option value="">Firma seçin…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <FieldError message={errors.companyId} />
          </Field>
          <Field label="Marka" hint="İsteğe bağlı">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={brands.length === 0}>
              <option value="">{brands.length === 0 ? 'Bu firmada marka yok' : 'Marka yok'}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Şube Adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Atatürk Lisesi Kantini" />
          <FieldError message={errors.name} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kod" hint="Çalışanların mesajla gönderebileceği kısa kod (örn. 1234)">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="1234" />
            <FieldError message={errors.code} />
          </Field>
          <Field label="Tür">
            <Select value={type} onChange={(e) => setType(e.target.value as OutletType)}>
              {OUTLET_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Şehir" hint="İsteğe bağlı">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Örn. Ankara" />
          </Field>
          <Field label="Kampüs" hint="İsteğe bağlı">
            <Input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Örn. Merkez Kampüs" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Ortaokul Öğrenci Sayısı"
            hint="İsteğe bağlı — özellikle kantinler için"
          >
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Örn. 1200"
              value={studentOrtaokul}
              onChange={(e) => setStudentOrtaokul(e.target.value)}
            />
          </Field>
          <Field label="Lise Öğrenci Sayısı" hint="İsteğe bağlı — özellikle kantinler için">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Örn. 150"
              value={studentLise}
              onChange={(e) => setStudentLise(e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <Switch
            checked={expectsDailyRevenue}
            onChange={setExpectsDailyRevenue}
            label="Günlük ciro beklenir"
            description="Açıkken bu şube günlük ciro bildirmezse eksik ciro uyarısı üretilir."
          />
        </div>
      </div>
    </Modal>
  );
}
