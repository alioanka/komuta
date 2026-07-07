'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { Modal, ConfirmDialog } from '@/components/ui/overlay';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  FieldError,
  Input,
  Skeleton,
  Switch,
  cn,
} from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { IconChevron, IconCompanies, IconEdit, IconPlus, IconTrash } from '@/components/icons';
import { MSG } from '@/lib/validate';
import type { Company } from '@/lib/types';

/* ------------------------------------------- Create / rename modal ------ */
function CompanyFormModal({
  open,
  onClose,
  company,
}: {
  open: boolean;
  onClose: () => void;
  company?: Company | null;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const isEdit = !!company;

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? '');
    setIsActive(company?.isActive ?? true);
    setError(undefined);
  }, [open, company]);

  const save = useMutation({
    mutationFn: () =>
      isEdit && company
        ? apiFetch(`/companies/${company.id}`, { method: 'PATCH', body: { name: name.trim(), isActive } })
        : apiFetch('/companies', { method: 'POST', body: { name: name.trim() } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies'] });
      push({ tone: 'success', title: isEdit ? 'Firma güncellendi' : 'Firma oluşturuldu', body: name.trim() });
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
      title={isEdit ? 'Firmayı Düzenle' : 'Yeni Firma'}
      subtitle={isEdit ? company?.name : 'Portföyünüze yeni bir firma ekleyin'}
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
        <Field label="Firma Adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Kaya Gıda A.Ş." />
          <FieldError message={error} />
        </Field>
        {isEdit && (
          <div className="rounded-xl border border-slate-200 p-4">
            <Switch
              checked={isActive}
              onChange={setIsActive}
              label="Firma aktif"
              description="Pasif firmalar raporlarda geri planda görünür; verileri korunur."
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- Page ------- */
export default function CompaniesPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();

  const canCreate = can('company:create');
  const canUpdate = can('company:update');
  const canDelete = can('company:delete');

  const [formOpen, setFormOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies'] });
      push({ tone: 'success', title: 'Firma silindi', body: deleteCompany?.name });
      setDeleteCompany(null);
    },
    onError: (e) => {
      const isConflict = e instanceof ApiError && e.status === 409;
      push({
        tone: 'danger',
        title: isConflict ? 'Firma silinemedi' : 'İşlem başarısız',
        body: isConflict
          ? 'Bu firmaya bağlı şubeler var. Önce şubeleri başka bir firmaya taşıyın veya silin.'
          : (e as Error).message,
      });
      setDeleteCompany(null);
    },
  });

  const list = companies.data ?? [];

  return (
    <AppShell title={t.nav.companies} subtitle="Firma portföyü ve markalar">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {companies.isSuccess ? `${formatNumber(list.length)} firma` : ' '}
        </p>
        {canCreate && (
          <Button size="sm" onClick={() => { setEditCompany(null); setFormOpen(true); }}>
            <IconPlus width={16} height={16} />
            Yeni Firma
          </Button>
        )}
      </div>

      {companies.isError ? (
        <ErrorState message={(companies.error as Error).message} onRetry={() => companies.refetch()} />
      ) : companies.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconCompanies width={40} height={40} />}
          title="Henüz firma yok"
          description="Şubelerinizi gruplamak için ilk firmanızı oluşturun."
          action={
            canCreate ? (
              <Button size="sm" onClick={() => { setEditCompany(null); setFormOpen(true); }}>
                <IconPlus width={16} height={16} />
                Yeni Firma
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card
              key={c.id}
              className={cn('group h-full p-5 transition-shadow hover:shadow-card-hover', !c.isActive && 'opacity-60')}
            >
              <div className="flex items-start justify-between">
                <Link href={`/firmalar/${c.id}`} className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-base font-semibold text-brand">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800 group-hover:text-brand">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.slug}</p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-0.5">
                  {canUpdate && (
                    <button
                      onClick={() => { setEditCompany(c); setFormOpen(true); }}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-100 hover:text-brand"
                      title="Düzenle"
                    >
                      <IconEdit width={16} height={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleteCompany(c)}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-brand-danger"
                      title="Sil"
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  )}
                  <Link
                    href={`/firmalar/${c.id}`}
                    className="rounded-lg p-2 text-slate-300 transition-colors hover:text-brand"
                    aria-label={`${c.name} detayı`}
                  >
                    <IconChevron width={16} height={16} />
                  </Link>
                </div>
              </div>
              <CardBody className="flex items-center gap-2 px-0 pb-0 pt-4">
                <Badge tone="accent">
                  {formatNumber(c._count.outlets)} {t.nav.outlets.toLowerCase()}
                </Badge>
                {c.brands.length > 0 && (
                  <Badge tone="neutral">
                    {formatNumber(c.brands.length)} {t.domain.brand.toLowerCase()}
                  </Badge>
                )}
                {!c.isActive && <Badge tone="neutral">Pasif</Badge>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <CompanyFormModal open={formOpen} onClose={() => setFormOpen(false)} company={editCompany} />

      <ConfirmDialog
        open={!!deleteCompany}
        onClose={() => setDeleteCompany(null)}
        onConfirm={() => deleteCompany && remove.mutate(deleteCompany.id)}
        loading={remove.isPending}
        title="Firmayı sil"
        message={
          <>
            <strong>{deleteCompany?.name}</strong> silinecek. Firmaya bağlı şube varsa silme işlemi reddedilir —
            önce şubeleri taşımanız veya silmeniz gerekir.
          </>
        }
        confirmLabel="Firmayı Sil"
      />
    </AppShell>
  );
}
