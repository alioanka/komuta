'use client';

export const dynamic = 'force-dynamic';

import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui';
import { IconInbox } from '@/components/icons';

export default function MessagesPage() {
  const { t } = useI18n();

  return (
    <AppShell title={t.nav.messages}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Gelen Kutusu" subtitle="WhatsApp konuşmaları" action={<Badge tone="accent">Yakında</Badge>} />
          <CardBody>
            <ul className="space-y-2">
              {['Tümü', 'Onay bekleyen', 'Eşleşmeyen'].map((label) => (
                <li
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm text-slate-500"
                >
                  <span>{label}</span>
                  <span className="text-xs text-slate-300">—</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody>
            <EmptyState
              icon={<IconInbox width={40} height={40} />}
              title="Mesajlaşma yakında"
              description="WhatsApp gelen/giden mesajları burada görünecek. Şimdilik gönderen eşleştirmelerini Eşleştirme sayfasından yönetebilirsiniz."
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
