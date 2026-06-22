import type { catalog } from '@komuta/shared';
import type { OutletType } from '@komuta/shared';

type Catalog = (typeof catalog)['tr'];

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
