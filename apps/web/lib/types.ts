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
  studentOrtaokul?: number | null;
  studentLise?: number | null;
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
  note?: string | null;
}

/** Paginated list response ({items,total}) — some endpoints may return bare arrays. */
export type Paginated<T> = { items: T[]; total: number };

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

export interface UserScopeItem {
  companyId: string | null;
  outletId: string | null;
  company?: { name: string } | null;
  outlet?: { name: string } | null;
}

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  phoneE164?: string | null;
  grantedPermissions?: Permission[];
  revokedPermissions?: Permission[];
  scopes?: UserScopeItem[];
}

export interface PermissionsMeta {
  permissions: Permission[];
  rolePermissions: Record<Role, Permission[]>;
}

/* --------------------------------------------------------- Reports --- */
export interface ReportRevenueRow {
  key: string;
  label: string;
  total: string | number;
  count: number;
  avg: string | number;
}

export interface ReportRevenueResponse {
  rows: ReportRevenueRow[];
  totalSum: string | number;
  totalCount: number;
}

export interface BranchReportRow {
  outletId: string;
  name: string;
  code: string;
  company: string;
  brand: string | null;
  type: OutletType;
  studentOrtaokul: number;
  studentLise: number;
  studentTotal: number;
  totalRevenue: string | number;
  dayCount: number;
  avgDailyRevenue: string | number;
}

/* ----------------------------------------------- Revenue import --- */
export interface RevenueImportRow {
  date: string;
  storeCode: string;
  amount: string;
}

export interface RevenueImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; storeCode: string; reason: string }[];
}

/* ------------------------------------------- Dashboard config --- */
export type DashboardWidgetId =
  | 'kpis'
  | 'trend'
  | 'perCompany'
  | 'missing'
  | 'studentVsRevenue'
  | 'notifications';

export interface DashboardConfig {
  /** Ordered list of widgets; each carries its own visibility flag. */
  widgets: { id: DashboardWidgetId; visible: boolean }[];
  /** Empty string / undefined → all companies. */
  companyId?: string;
}

export interface Employee {
  id: string;
  fullName: string;
  outletId: string | null;
  isActive?: boolean;
  outlet?: { id: string; name: string; code?: string } | null;
}
