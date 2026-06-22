/**
 * Domain enums shared between the API, worker and web. These mirror the Prisma
 * schema enums exactly — keep them in sync (see /docs/10_ARCHITECTURE.md).
 */

export const OutletType = {
  SCHOOL_CANTEEN: 'SCHOOL_CANTEEN',
  UNIVERSITY_CANTEEN: 'UNIVERSITY_CANTEEN',
  CANTEEN: 'CANTEEN',
  REFECTORY: 'REFECTORY',
  RESTAURANT: 'RESTAURANT',
  FACTORY: 'FACTORY',
  CAFE: 'CAFE',
} as const;
export type OutletType = (typeof OutletType)[keyof typeof OutletType];

export const MappingStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
} as const;
export type MappingStatus = (typeof MappingStatus)[keyof typeof MappingStatus];

export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  MANAGER: 'MANAGER',
  VIEWER: 'VIEWER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const EntrySource = {
  WHATSAPP: 'WHATSAPP',
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
} as const;
export type EntrySource = (typeof EntrySource)[keyof typeof EntrySource];

export const EntryStatus = {
  CONFIRMED: 'CONFIRMED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

export const MessageDirection = {
  IN: 'IN',
  OUT: 'OUT',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

export const ResolutionStatus = {
  MAPPED: 'MAPPED',
  NEEDS_STORE_ID: 'NEEDS_STORE_ID',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  AMBIGUOUS: 'AMBIGUOUS',
  UNPARSEABLE: 'UNPARSEABLE',
  DUPLICATE: 'DUPLICATE',
} as const;
export type ResolutionStatus = (typeof ResolutionStatus)[keyof typeof ResolutionStatus];

export const TemplateCategory = {
  MARKETING: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION',
} as const;
export type TemplateCategory = (typeof TemplateCategory)[keyof typeof TemplateCategory];

export const TemplateStatus = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
} as const;
export type TemplateStatus = (typeof TemplateStatus)[keyof typeof TemplateStatus];

export const NotificationChannel = {
  INAPP: 'INAPP',
  TELEGRAM: 'TELEGRAM',
  WHATSAPP: 'WHATSAPP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationEvent = {
  MISSING_REVENUE: 'MISSING_REVENUE',
  UNMAPPED_SENDER: 'UNMAPPED_SENDER',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  PARSE_FAILED: 'PARSE_FAILED',
  DAILY_SUMMARY: 'DAILY_SUMMARY',
  ANOMALY: 'ANOMALY',
} as const;
export type NotificationEvent = (typeof NotificationEvent)[keyof typeof NotificationEvent];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
