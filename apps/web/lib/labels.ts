import type { Messages, OutletType, ResolutionStatus, NotificationEvent } from '@komuta/shared';

type Catalog = Messages;

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
