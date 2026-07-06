/** Shared client-side types mirroring the API response shapes. */

import type {
  Role,
  Permission,
  OutletType,
  MappingStatus,
  ResolutionStatus,
  NotificationEvent,
} from '@komuta/shared';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  scopeCompanyIds: string[];
  scopeOutletIds: string[];
  unscoped: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface TrendPoint {
  date: string;
  total: string;
}

export interface PerCompany {
  companyId: string;
  name: string;
  outletCount: number;
  totalToday: string;
  reported: number;
}

export interface DashboardOverview {
  date: string;
  totalRevenueToday: string;
  outletsExpected: number;
  outletsReported: number;
  pendingConfirmations: number;
  trend: TrendPoint[];
  perCompany: PerCompany[];
}

export interface MissingOutlet {
  outletId: string;
  name: string;
  code: string;
  company: string;
}

export type CellStatus = 'received' | 'missing' | 'pending';

export interface MonitorCell {
  date: string;
  status: CellStatus;
}

export interface MonitorRow {
  outletId: string;
  name: string;
  code: string;
  company: string;
  cells: MonitorCell[];
}

export interface MonitorMatrix {
  dates: string[];
  rows: MonitorRow[];
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  brands: { id: string; name: string; slug: string }[];
  _count: { outlets: number };
}

export interface Outlet {
  id: string;
  companyId: string;
  brandId: string | null;
  name: string;
  code: string;
  type: OutletType;
  city: string | null;
  campus: string | null;
  expectsDailyRevenue: boolean;
  isActive: boolean;
  company: { id: string; name: string; slug: string };
  brand: { id: string; name: string } | null;
  aliases: { id: string; alias: string }[];
}

export interface RevenueEntry {
  id: string;
  outletId: string;
  businessDate: string;
  amount: string;
  status: string;
  source: string;
}

export interface InventorySnapshot {
  id: string;
  asOfDate: string;
  stockValue: string;
  note: string | null;
}

export interface PayrollEntry {
  id: string;
  periodMonth: string;
  totalSalary: string;
  employeeCount: number | null;
}

export interface PurchaseEntry {
  id: string;
  periodMonth: string;
  amount: string;
  note: string | null;
}

export interface StudentCount {
  id: string;
  periodMonth: string;
  ortaokul: number;
  lise: number;
}

export interface HeadcountCorrection {
  id: string;
  periodMonth: string;
  employeeCount: number;
  reason: string | null;
}

export interface OutletDetail {
  outlet: Outlet & { company: { id: string; name: string }; brand: { id: string; name: string } | null };
  revenue: RevenueEntry[];
  inventory: InventorySnapshot[];
  payroll: PayrollEntry[];
  purchases: PurchaseEntry[];
  studentCounts: StudentCount[];
  headcounts: HeadcountCorrection[];
}

export interface PhoneMapping {
  id: string;
  phoneE164: string;
  status: MappingStatus;
  outletId: string | null;
  createdAt: string;
  outlet: { id: string; name: string; code: string } | null;
  employee: { id: string; fullName: string } | null;
}

export interface WhatsAppMessage {
  id: string;
  waMessageId: string;
  direction: 'IN' | 'OUT';
  fromPhone: string;
  toPhone: string;
  body: string;
  type: string;
  status: string | null;
  parsedAmount: string | null;
  resolvedOutletId: string | null;
  resolutionStatus: ResolutionStatus | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string | null;
  channel: string;
  event: NotificationEvent;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}
