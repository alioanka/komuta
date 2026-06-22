'use client';

export const dynamic = 'force-dynamic';

import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Card, CardBody, EmptyState } from '@/components/ui';
import { IconBell } from '@/components/icons';

export default function NotificationsPage() {
  const { t } = useI18n();

  return (
    <AppShell title={t.nav.notifications}>
      <Card>
        <CardBody>
          <EmptyState
            icon={<IconBell width={40} height={40} />}
            title="Bildirim yok"
            description="Eksik ciro, anomali ve günlük özet bildirimleri burada listelenecek."
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
