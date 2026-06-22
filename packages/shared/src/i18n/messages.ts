/**
 * Shared message catalog. TR is the primary locale (product default); EN is the
 * secondary. Keys are dot-namespaced. The web app (next-intl) and API both read
 * from this single source so nothing is hard-coded.
 */

export const tr = {
  app: {
    name: 'Komuta',
    tagline: 'Tek komuta merkezi',
  },
  nav: {
    overview: 'Genel Bakış',
    companies: 'Firmalar',
    outlets: 'Şubeler',
    monitor: 'İzleme',
    messages: 'Mesajlar',
    mapping: 'Eşleştirme',
    accounting: 'Muhasebe',
    settings: 'Ayarlar',
    notifications: 'Bildirimler',
    logout: 'Çıkış',
  },
  metrics: {
    revenue: 'Ciro',
    inventory: 'Stok',
    payroll: 'Personel Maaşı',
    purchases: 'Mal Alımı',
    studentCount: 'Öğrenci Sayısı',
    employeeCount: 'Çalışan Sayısı',
    ortaokul: 'Ortaokul',
    lise: 'Lise',
  },
  domain: {
    company: 'Firma',
    brand: 'Marka',
    outlet: 'Şube',
    canteen: 'Kantin',
    refectory: 'Yemekhane',
  },
  status: {
    received: 'Alındı',
    missing: 'Eksik',
    pending: 'Onay Bekliyor',
  },
  auth: {
    login: 'Giriş Yap',
    email: 'E-posta',
    password: 'Şifre',
    invalidCredentials: 'E-posta veya şifre hatalı.',
    accountLocked: 'Hesabınız geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.',
  },
  whatsapp: {
    revenueConfirmation: '✅ {outlet} için {amount} TL cironuz {date} tarihine kaydedildi.',
    missingReminder:
      'Merhaba {name}, bugünkü cironuzu henüz almadık. Lütfen tutarı bu numaraya gönderin.',
    storeIdRequest:
      'Cironuzu eşleştiremedik. Lütfen mağaza kodunuzu tutarla birlikte gönderin (örn: 1234 73256,76).',
    formatHelp:
      'Tutarı şu biçimlerde gönderebilirsiniz: 73256,76 — 73.256,76 — 73256.76 — 73,256.76',
  },
  errors: {
    forbidden: 'Bu işlem için yetkiniz yok.',
    notFound: 'Kayıt bulunamadı.',
    validation: 'Girdiğiniz bilgilerde hata var.',
  },
} as const;

/** Widen the nested literal types of `tr` to plain strings for other locales. */
export type Messages = { [K in keyof typeof tr]: { [P in keyof (typeof tr)[K]]: string } };

export const en: Messages = {
  app: {
    name: 'Komuta',
    tagline: 'A single command center',
  },
  nav: {
    overview: 'Overview',
    companies: 'Companies',
    outlets: 'Outlets',
    monitor: 'Monitor',
    messages: 'Messages',
    mapping: 'Mapping',
    accounting: 'Accounting',
    settings: 'Settings',
    notifications: 'Notifications',
    logout: 'Logout',
  },
  metrics: {
    revenue: 'Revenue',
    inventory: 'Inventory',
    payroll: 'Payroll',
    purchases: 'Purchases',
    studentCount: 'Student Count',
    employeeCount: 'Employee Count',
    ortaokul: 'Middle School',
    lise: 'High School',
  },
  domain: {
    company: 'Company',
    brand: 'Brand',
    outlet: 'Outlet',
    canteen: 'Canteen',
    refectory: 'Refectory',
  },
  status: {
    received: 'Received',
    missing: 'Missing',
    pending: 'Pending',
  },
  auth: {
    login: 'Sign in',
    email: 'Email',
    password: 'Password',
    invalidCredentials: 'Invalid email or password.',
    accountLocked: 'Your account is temporarily locked. Please try again later.',
  },
  whatsapp: {
    revenueConfirmation: '✅ Your revenue of {amount} TL for {outlet} was recorded for {date}.',
    missingReminder:
      "Hello {name}, we haven't received today's revenue yet. Please send the amount to this number.",
    storeIdRequest:
      'We could not match your revenue. Please send your store code with the amount (e.g. 1234 73256,76).',
    formatHelp: 'You can send the amount as: 73256,76 — 73.256,76 — 73256.76 — 73,256.76',
  },
  errors: {
    forbidden: 'You do not have permission for this action.',
    notFound: 'Record not found.',
    validation: 'There is an error in the information you entered.',
  },
};

export const catalog = { tr, en } as const;
export type Locale = keyof typeof catalog;
