'use client';

export const dynamic = 'force-dynamic';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { IconBell } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import type { UserRow } from '@/lib/types';

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: 'Sahip',
    ADMIN: 'Yönetici',
    ACCOUNTANT: 'Muhasebe',
    MANAGER: 'Müdür',
    VIEWER: 'İzleyici',
  };
  return map[role] ?? role;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const canReadUsers = can('user:read');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserRow[]>('/users'),
    enabled: canReadUsers,
  });

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Kullanıcı',
      render: (u) => (
        <div>
          <p className="font-medium text-slate-800">{u.fullName}</p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', render: (u) => <Badge tone="accent">{roleLabel(u.role)}</Badge> },
    {
      key: 'active',
      header: 'Durum',
      align: 'center',
      render: (u) =>
        u.isActive ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Pasif</Badge>,
    },
    { key: 'last', header: 'Son Giriş', align: 'right', render: (u) => formatDateTime(u.lastLoginAt) },
  ];

  return (
    <AppShell title={t.nav.settings}>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Kullanıcılar" subtitle="Panele erişimi olan kişiler" />
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
          ) : (
            <DataTable
              columns={columns}
              rows={users.data ?? []}
              getRowKey={(u) => u.id}
              empty="Kullanıcı bulunamadı."
            />
          )}
        </Card>

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
      </div>
    </AppShell>
  );
}
