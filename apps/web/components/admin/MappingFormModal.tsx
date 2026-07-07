'use client';

/**
 * Create / edit WhatsApp phone mapping modal — shared by the outlet settings
 * tab ("Numara Bağla") and the /eslestirme page ("Yeni Eşleştirme").
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MappingStatus } from '@komuta/shared';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/ui/overlay';
import { Button, Field, FieldError, Input, Select } from '@/components/ui';
import { mappingStatusLabel } from '@/lib/labels';
import { MSG, isValidE164, normalizePhoneInput } from '@/lib/validate';
import type { Employee, Outlet, PhoneMapping } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode; absent → create mode. */
  mapping?: PhoneMapping | null;
  outlets: Outlet[];
  /** Preselect (and lock) the outlet — used from the outlet settings tab. */
  lockOutletId?: string;
}

const STATUS_OPTIONS: MappingStatus[] = ['ACTIVE', 'PENDING', 'BLOCKED'];

export function MappingFormModal({ open, onClose, mapping, outlets, lockOutletId }: Props) {
  const qc = useQueryClient();
  const { push } = useToast();
  const isEdit = !!mapping;

  const [phone, setPhone] = useState('');
  const [outletId, setOutletId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState<MappingStatus>('ACTIVE');
  const [errors, setErrors] = useState<{ phone?: string; outletId?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (mapping) {
      setPhone(mapping.phoneE164);
      setOutletId(mapping.outlet?.id ?? mapping.outletId ?? lockOutletId ?? '');
      setEmployeeId(mapping.employee?.id ?? '');
      setStatus(mapping.status);
    } else {
      setPhone('');
      setOutletId(lockOutletId ?? '');
      setEmployeeId('');
      setStatus('ACTIVE');
    }
  }, [open, mapping, lockOutletId]);

  // Employees of the selected outlet, for the çalışan select.
  const employees = useQuery({
    queryKey: ['employees', outletId],
    queryFn: () => apiFetch<Employee[]>(`/employees?outletId=${outletId}`),
    enabled: open && !!outletId,
  });

  function validate(): boolean {
    const next: { phone?: string; outletId?: string } = {};
    const normalized = normalizePhoneInput(phone);
    if (!phone.trim()) next.phone = MSG.required;
    else if (!isValidE164(normalized)) next.phone = MSG.phone;
    if (!outletId) next.outletId = MSG.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        phoneE164: normalizePhoneInput(phone),
        outletId,
        employeeId: employeeId || null,
        status,
      };
      if (isEdit && mapping) return apiFetch(`/mappings/${mapping.id}`, { method: 'PATCH', body });
      return apiFetch('/mappings', { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mappings'] });
      void qc.invalidateQueries({ queryKey: ['employees'] });
      push({
        tone: 'success',
        title: isEdit ? 'Eşleştirme güncellendi' : 'Numara bağlandı',
        body: normalizePhoneInput(phone),
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
      title={isEdit ? 'Eşleştirmeyi Düzenle' : 'Numara Bağla'}
      subtitle="WhatsApp numarasını bir şubeye (ve isteğe bağlı bir çalışana) bağlayın"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {isEdit ? 'Kaydet' : 'Bağla'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Telefon" hint="Uluslararası biçim: +905321234567">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+90…"
            inputMode="tel"
          />
          <FieldError message={errors.phone} />
        </Field>

        <Field label="Şube">
          <Select
            value={outletId}
            disabled={!!lockOutletId}
            onChange={(e) => {
              setOutletId(e.target.value);
              setEmployeeId('');
            }}
          >
            <option value="">Şube seçin…</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </Select>
          <FieldError message={errors.outletId} />
        </Field>

        <Field label="Çalışan" hint="İsteğe bağlı — bu şubenin çalışanları">
          <Select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={!outletId || employees.isLoading}
          >
            <option value="">
              {!outletId
                ? 'Önce şube seçin'
                : employees.isLoading
                  ? 'Yükleniyor…'
                  : (employees.data ?? []).length === 0
                    ? 'Bu şubede çalışan yok'
                    : 'Çalışan seçin (isteğe bağlı)'}
            </option>
            {(employees.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value as MappingStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {mappingStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
