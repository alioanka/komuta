import type {
  MappingStatus,
  Messages,
  OutletType,
  Permission,
  ResolutionStatus,
  NotificationEvent,
  Role,
} from '@komuta/shared';

type Catalog = Messages;

/* ------------------------------------------------------------- Roles --- */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  ACCOUNTANT: 'Muhasebe',
  MANAGER: 'Müdür',
  VIEWER: 'İzleyici',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export const ROLE_OPTIONS: { value: Role; label: string }[] = (
  ['OWNER', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER'] as Role[]
).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

/* ------------------------------------------------------ Outlet types --- */
export const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  SCHOOL_CANTEEN: 'Okul Kantini',
  UNIVERSITY_CANTEEN: 'Üniversite Kantini',
  CANTEEN: 'Kantin',
  REFECTORY: 'Yemekhane',
  RESTAURANT: 'Restoran',
  FACTORY: 'Fabrika',
  CAFE: 'Kafe',
};

export const OUTLET_TYPE_OPTIONS: { value: OutletType; label: string }[] = (
  Object.entries(OUTLET_TYPE_LABELS) as [OutletType, string][]
).map(([value, label]) => ({ value, label }));

/* --------------------------------------------------- Mapping statuses --- */
export function mappingStatusLabel(status: MappingStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Aktif';
    case 'PENDING':
      return 'Onay Bekliyor';
    case 'BLOCKED':
      return 'Engelli';
    default:
      return status;
  }
}

export function mappingStatusTone(status: MappingStatus): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'BLOCKED':
      return 'danger';
    default:
      return 'warning';
  }
}

/* ------------------------------------------------------- Permissions --- */
/** `resource:action` → Turkish resource group label. */
export const PERMISSION_RESOURCE_LABELS: Record<string, string> = {
  company: 'Firma',
  brand: 'Marka',
  outlet: 'Şube',
  alias: 'Takma Ad',
  employee: 'Çalışan',
  user: 'Kullanıcı',
  mapping: 'Eşleştirme',
  revenue: 'Ciro',
  payroll: 'Personel Maaşı',
  purchases: 'Mal Alımı',
  inventory: 'Stok',
  studentCount: 'Öğrenci Sayısı',
  headcount: 'Çalışan Sayısı',
  dashboard: 'Panel',
  monitor: 'İzleme',
  message: 'Mesaj',
  template: 'Şablon',
  notification: 'Bildirim',
  settings: 'Ayarlar',
  audit: 'Denetim',
};

const PERMISSION_ACTION_LABELS: Record<string, string> = {
  read: 'Görüntüle',
  create: 'Oluştur',
  update: 'Düzenle',
  delete: 'Sil',
  write: 'Yaz',
  approve: 'Onayla',
  send: 'Gönder',
  manage: 'Yönet',
};

export function permissionResourceLabel(resource: string): string {
  return PERMISSION_RESOURCE_LABELS[resource] ?? resource;
}

export function permissionActionLabel(permission: Permission | string): string {
  const action = String(permission).split(':')[1] ?? '';
  return PERMISSION_ACTION_LABELS[action] ?? action;
}

/** Outlet type → human label, reusing catalog.domain keys where they map. */
export function outletTypeLabel(type: OutletType, t: Catalog): string {
  switch (type) {
    case 'SCHOOL_CANTEEN':
      return `Okul ${t.domain.canteen}`;
    case 'UNIVERSITY_CANTEEN':
      return `Üniversite ${t.domain.canteen}`;
    case 'CANTEEN':
      return t.domain.canteen;
    case 'REFECTORY':
      return t.domain.refectory;
    case 'RESTAURANT':
      return 'Restoran';
    case 'FACTORY':
      return 'Fabrika';
    case 'CAFE':
      return 'Kafe';
    default:
      return type;
  }
}

/** WhatsApp resolution status → Turkish label (English in comments). */
export function resolutionStatusLabel(status: ResolutionStatus, t: Catalog): string {
  switch (status) {
    case 'MAPPED':
      return 'Eşleşti'; // matched
    case 'NEEDS_STORE_ID':
      return 'Kod gerekli'; // store code required
    case 'NEEDS_CONFIRMATION':
      return t.status.pending;
    case 'AMBIGUOUS':
      return 'Belirsiz'; // ambiguous
    case 'UNPARSEABLE':
      return 'Çözümlenemedi'; // unparseable
    case 'DUPLICATE':
      return 'Tekrar'; // duplicate
    case 'BLOCKED':
      return 'Engellendi'; // sender blocked
    default:
      return status;
  }
}

/** Resolution status → badge tone. */
export function resolutionStatusTone(
  status: ResolutionStatus,
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'MAPPED':
      return 'success';
    case 'NEEDS_STORE_ID':
    case 'NEEDS_CONFIRMATION':
    case 'AMBIGUOUS':
      return 'warning';
    case 'UNPARSEABLE':
    case 'BLOCKED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Notification event → Turkish label (English in comments). */
export function notificationEventLabel(event: NotificationEvent): string {
  switch (event) {
    case 'MISSING_REVENUE':
      return 'Eksik ciro'; // missing revenue
    case 'UNMAPPED_SENDER':
      return 'Eşleşmeyen gönderen'; // unmapped sender
    case 'NEEDS_CONFIRMATION':
      return 'Onay bekliyor'; // needs confirmation
    case 'PARSE_FAILED':
      return 'Çözümlenemeyen mesaj'; // parse failed
    case 'DAILY_SUMMARY':
      return 'Günlük özet'; // daily summary
    case 'ANOMALY':
      return 'Anomali'; // anomaly
    default:
      return event;
  }
}

/** Revenue/entry status → catalog status label. */
export function entryStatusLabel(status: string, t: Catalog): string {
  switch (status) {
    case 'CONFIRMED':
      return t.status.received;
    case 'PENDING_REVIEW':
      return t.status.pending;
    case 'REJECTED':
      return 'Reddedildi';
    case 'SUPERSEDED':
      return 'Güncellendi';
    default:
      return status;
  }
}
