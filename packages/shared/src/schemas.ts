import { z } from 'zod';
import { OutletType, Role, NotificationChannel, NotificationEvent } from './enums.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@komuta/config';

/** A YYYY-MM-DD calendar date. */
export const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** A YYYY-MM month period. */
export const periodMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');

/** A positive monetary amount with up to 2 decimals, as a string (precision-safe). */
export const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Expected a positive amount like 1234.56');

/** E.164 phone, e.g. +905551112233. */
export const phoneE164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Expected E.164 phone');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, 'En az 10 karakter').max(200),
});

// --- Users ---
export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.nativeEnum(Role),
  password: z.string().min(10).max(200),
  scopeCompanyIds: z.array(z.string()).optional(),
  scopeOutletIds: z.array(z.string()).optional(),
});

// --- Companies / Brands / Outlets ---
export const createCompanySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).optional(),
});

export const createBrandSchema = z.object({
  companyId: z.string(),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).optional(),
});

export const createOutletSchema = z.object({
  companyId: z.string(),
  brandId: z.string().optional(),
  name: z.string().min(2).max(160),
  code: z.string().min(1).max(40),
  type: z.nativeEnum(OutletType),
  city: z.string().max(80).optional(),
  campus: z.string().max(120).optional(),
  expectsDailyRevenue: z.boolean().default(true),
});

export const createAliasSchema = z.object({
  outletId: z.string(),
  alias: z.string().min(1).max(160),
});

// --- Revenue ---
export const createRevenueSchema = z.object({
  outletId: z.string(),
  businessDate: businessDateSchema,
  amount: moneySchema,
  note: z.string().max(500).optional(),
});

// --- Monthly accounting entries ---
export const payrollSchema = z.object({
  outletId: z.string(),
  periodMonth: periodMonthSchema,
  totalSalary: moneySchema,
  employeeCount: z.coerce.number().int().min(0).optional(),
});

export const purchaseSchema = z.object({
  outletId: z.string(),
  periodMonth: periodMonthSchema,
  amount: moneySchema,
  note: z.string().max(500).optional(),
});

export const inventorySchema = z.object({
  outletId: z.string(),
  asOfDate: businessDateSchema,
  stockValue: moneySchema,
  note: z.string().max(500).optional(),
});

export const studentCountSchema = z.object({
  outletId: z.string(),
  periodMonth: periodMonthSchema,
  ortaokul: z.coerce.number().int().min(0),
  lise: z.coerce.number().int().min(0),
});

export const headcountSchema = z.object({
  outletId: z.string(),
  periodMonth: periodMonthSchema,
  employeeCount: z.coerce.number().int().min(0),
  reason: z.string().max(300).optional(),
});

// --- Mappings ---
export const approveMappingSchema = z.object({
  mappingId: z.string(),
  outletId: z.string(),
});

// --- Messaging ---
export const sendMessageSchema = z.object({
  toPhone: phoneE164Schema,
  body: z.string().max(4096).optional(),
  templateName: z.string().optional(),
  templateVars: z.array(z.string()).optional(),
});

// --- Notifications ---
export const notificationRuleSchema = z.object({
  name: z.string().min(2).max(120),
  event: z.nativeEnum(NotificationEvent),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1),
  targetUserIds: z.array(z.string()).default([]),
  targetTelegramChatIds: z.array(z.string()).default([]),
  scheduleCron: z.string().max(120).optional(),
  isActive: z.boolean().default(true),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateOutletInput = z.infer<typeof createOutletSchema>;
export type CreateRevenueInput = z.infer<typeof createRevenueSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type NotificationRuleInput = z.infer<typeof notificationRuleSchema>;
