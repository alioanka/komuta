'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { AppShell } from '@/components/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { UserFormModal } from '@/components/admin/UserFormModal';
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
import { IconBell, IconEdit, IconKey, IconPlus, IconTrash, IconUsers } from '@/components/icons';
import { formatDateTime, formatPhone } from '@/lib/format';
import { roleLabel } from '@/lib/labels';
import { MSG } from '@/lib/validate';
import type { Company, Outlet, PermissionsMeta, UserRow } from '@/lib/types';

type Tab = 'users' | 'notifications';

/* --------------------------------------------- Password reset modal ----- */
function ResetPasswordModal({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { push } = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const reset = useMutation({
    mutationFn: () =>
      apiFetch(`/users/${user?.id}/reset-password`, { method: 'POST', body: { newPassword: password } }),
    onSuccess: () => {
      push({ tone: 'success', title: 'Şifre sıfırlandı', body: user?.fullName });
      setPassword('');
      onClose();
    },
    onError: (e) => push({ tone: 'danger', title: 'Şifre sıfırlanamadı', body: (e as Error).message }),
  });

  function submit() {
    if (!password) return setError(MSG.required);
    if (password.length < 8) return setError(MSG.passwordMin);
    setError(undefined);
    reset.mutate();
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Şifre Sıfırla"
      subtitle={user ? `${user.fullName} · ${user.email}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={reset.isPending}>
            Şifreyi Değiştir
          </Button>
        </>
      }
    >
      <Field label="Yeni Şifre" hint="En az 8 karakter. Kullanıcıya yeni şifreyi güvenli bir kanaldan iletin.">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <FieldError message={error} />
      </Field>
    </Modal>
  );
}

/* ----------------------------------------------------------- Page ------- */
export default function SettingsPage() {
  const { t } = useI18n();
  const { can, user: me } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();

  const canReadUsers = can('user:read');
  const canCreate = can('user:create');
  const canUpdate = can('user:update');
  const canDelete = can('user:delete');

  const [tab, setTab] = useState<Tab>('users');
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserRow[]>('/users'),
    enabled: canReadUsers,
  });

  const permissionsMeta = useQuery({
    queryKey: ['users', 'permissions'],
    queryFn: () => apiFetch<PermissionsMeta>('/users/permissions'),
    enabled: canReadUsers && canUpdate,
  });

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Company[]>('/companies'),
    enabled: canReadUsers && (canCreate || canUpdate),
  });

  const outlets = useQuery({
    queryKey: ['outlets'],
    queryFn: () => apiFetch<Outlet[]>('/outlets'),
    enabled: canReadUsers && (canCreate || canUpdate),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      push({ tone: 'success', title: 'Kullanıcı devre dışı bırakıldı', body: deleteUser?.fullName });
      setDeleteUser(null);
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}`, { method: 'PATCH', body: { isActive: true } }),
    onSuccess: (_d, _id) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      push({ tone: 'success', title: 'Kullanıcı yeniden aktifleştirildi' });
    },
    onError: (e) => push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message }),
  });

  function openCreate() {
    setEditUser(null);
    setFormOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setFormOpen(true);
  }

  function scopeSummary(u: UserRow): React.ReactNode {
    const scopes = u.scopes ?? [];
    if (scopes.length === 0) return <span className="text-xs text-slate-400">Tümü</span>;
    const names = scopes
      .map((s) => s.outlet?.name ?? s.company?.name)
      .filter(Boolean) as string[];
    const shown = names.slice(0, 2);
    return (
      <div className="flex flex-wrap items-center gap-1">
        {shown.map((n, i) => (
          <Badge key={`${n}-${i}`} tone="neutral">
            {n}
          </Badge>
        ))}
        {names.length > 2 && <span className="text-xs text-slate-400">+{names.length - 2}</span>}
      </div>
    );
  }

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Kullanıcı',
      render: (u) => (
        <div className={cn(!u.isActive && 'opacity-50')}>
          <p className="font-medium text-slate-800">
            {u.fullName}
            {u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(siz)</span>}
          </p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (u) => <Badge tone="accent">{roleLabel(u.role)}</Badge> },
    {
      key: 'phone',
      header: 'Telefon',
      render: (u) =>
        u.phoneE164 ? <span className="font-mono text-xs text-slate-500">{formatPhone(u.phoneE164)}</span> : '—',
    },
    { key: 'scope', header: 'Kapsam', render: scopeSummary },
    {
      key: 'active',
      header: 'Durum',
      align: 'center',
      render: (u) =>
        u.isActive ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Pasif</Badge>,
    },
    { key: 'last', header: 'Son Giriş', align: 'right', render: (u) => formatDateTime(u.lastLoginAt) },
    ...(canUpdate || canDelete
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (u: UserRow) => (
              <div className="flex items-center justify-end gap-1">
                {canUpdate && (
                  <button
                    onClick={() => openEdit(u)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand"
                    title="Düzenle"
                  >
                    <IconEdit width={16} height={16} />
                  </button>
                )}
                {canUpdate && (
                  <button
                    onClick={() => setResetUser(u)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-600"
                    title="Şifre Sıfırla"
                  >
                    <IconKey width={16} height={16} />
                  </button>
                )}
                {u.isActive
                  ? canDelete &&
                    u.id !== me?.id && (
                      <button
                        onClick={() => setDeleteUser(u)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-brand-danger"
                        title="Devre Dışı Bırak"
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    )
                  : canUpdate && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        loading={reactivate.isPending && reactivate.variables === u.id}
                        onClick={() => reactivate.mutate(u.id)}
                      >
                        Aktifleştir
                      </Button>
                    )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Kullanıcılar' },
    { id: 'notifications', label: 'Bildirim Kuralları' },
  ];

  return (
    <AppShell title={t.nav.settings} subtitle="Kullanıcılar, izinler ve bildirim ayarları">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:w-fit">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                tab === tb.id ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <Card>
            <CardHeader
              title="Kullanıcılar"
              subtitle="Panele erişimi olan kişiler ve yetkileri"
              action={
                canCreate ? (
                  <Button size="sm" onClick={openCreate}>
                    <IconPlus width={16} height={16} />
                    Yeni Kullanıcı
                  </Button>
                ) : undefined
              }
            />
            {!canReadUsers ? (
              <div className="p-5">
                <EmptyState title={t.errors.forbidden} description="Kullanıcıları görüntüleme yetkiniz yok." />
              </div>
            ) : users.isError ? (
              <div className="p-5">
                <ErrorState message={(users.error as Error).message} onRetry={() => users.refetch()} />
              </div>
            ) : users.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (users.data ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<IconUsers width={40} height={40} />}
                  title="Henüz kullanıcı yok"
                  description="Ekibinize panel erişimi vermek için ilk kullanıcıyı ekleyin."
                  action={
                    canCreate ? (
                      <Button size="sm" onClick={openCreate}>
                        <IconPlus width={16} height={16} />
                        Yeni Kullanıcı
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <DataTable columns={columns} rows={users.data ?? []} getRowKey={(u) => u.id} />
            )}
          </Card>
        )}

        {tab === 'notifications' && (
          <Card>
            <CardHeader title="Bildirim Kuralları" subtitle="Eksik ciro, anomali ve özet bildirimleri" />
            <CardBody>
              <EmptyState
                icon={<IconBell width={40} height={40} />}
                title="Yakında"
                description="Bildirim kurallarını (kanal, olay, hedef kullanıcılar) buradan yönetebileceksiniz."
              />
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create / edit */}
      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editUser}
        companies={companies.data ?? []}
        outlets={outlets.data ?? []}
        permissionsMeta={permissionsMeta.data}
      />

      {/* Password reset */}
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />

      {/* Soft delete */}
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && remove.mutate(deleteUser.id)}
        loading={remove.isPending}
        title="Kullanıcıyı devre dışı bırak"
        message={
          <>
            <strong>{deleteUser?.fullName}</strong> ({deleteUser?.email}) devre dışı bırakılacak ve panele
            giriş yapamayacak. Geçmiş kayıtları korunur; daha sonra yeniden aktifleştirebilirsiniz.
          </>
        }
        confirmLabel="Devre Dışı Bırak"
      />
    </AppShell>
  );
}
