# Komuta — Overview

> **Komuta** (Turkish for "command") is a production internal operations platform for
> a Turkish food-service business. It turns daily WhatsApp text messages from employees
> into structured, validated, dashboarded revenue data.

This is the first document to read. It explains **what** Komuta is, **who** uses it,
**the business it models**, and **where to go next**. Every other document in `docs/`
is linked from here.

---

## 1. What Komuta does (in one paragraph)

Every day, employees across dozens of outlets send their daily revenue
(**ciro** = "revenue/turnover" in Turkish) as a **plain-text WhatsApp message** to a
single WhatsApp Business phone number — for example `73256,76` or
`Çamlıca 73256,76`. Komuta receives that message through Meta's **WhatsApp Cloud API
webhook**, parses the money amount, figures out *which outlet* the sender belongs to,
stores the record in PostgreSQL, and shows it on dashboards to the business owner
(**Özer**) and the accountant (**Salih**). It also sends back WhatsApp confirmations,
chases missing reports, and raises Telegram alerts for the operators.

The whole system is designed to run on **a single small VPS** (Contabo) with Docker
Compose, so it is cheap and easy to maintain.

---

## 2. The business domain

The owner (**Özer Kaya**) runs **4 legal companies** ("Firma"). Each company owns one
or more **brands**, and each brand operates one or more **outlets** ("Şube"). Revenue
is always reported **per outlet**.

```
Firma (Company)
   └── Brand
          └── Outlet / Şube  ←── revenue ("ciro") is reported here
```

### The 4 companies, their brands, and outlets

| Company (Firma)     | Brand                        | Outlets / scope                                                                 |
|---------------------|------------------------------|---------------------------------------------------------------------------------|
| **Kakao Gıda**      | Bahçeşehir Koleji            | **60+ school canteens** (Kantin) across Bahçeşehir Koleji schools               |
|                     | Bahçeşehir Üniversitesi      | **10+ university canteens** + **5+ refectories** (Yemekhane)                    |
| **ZerKay Gıda**     | Pizza Sando                  | Pizza takeaway outlet(s)                                                        |
|                     | LCW                          | **2 canteens** (LC Waikiki staff canteens)                                      |
|                     | SuperMoon                    | **Croissant factory** (production, not a storefront)                            |
| **Roka Gıda**       | Biruni Üniversitesi          | **1 refectory** (Yemekhane) at Biruni University                                |
| **Bakır Kupa Gıda** | Espressolab Isparta İyaşpark | **1 café** at the İyaşpark mall, Isparta                                        |

> The exact list of outlets is seeded into the database (see
> [`01_LOCAL_DEVELOPMENT.md`](./01_LOCAL_DEVELOPMENT.md) → seeding). Real-world
> outlets are added/edited from the dashboard.

---

## 3. Glossary (Turkish ↔ English)

These terms appear throughout the UI, the database, and these docs. The UI is
**Turkish-primary**, so the Turkish word is the canonical one.

| Turkish term            | English meaning                       | Notes                                                                 |
|-------------------------|----------------------------------------|-----------------------------------------------------------------------|
| **Ciro**                | Revenue / daily turnover              | The core metric. Reported daily per outlet via WhatsApp.             |
| **Stok**                | Inventory / stock                     | Monthly value entered by the accountant.                            |
| **Personel Maaşı**      | Payroll / staff salary                | Monthly expense.                                                     |
| **Mal Alım**            | Purchases / goods bought              | Monthly expense (cost of goods).                                    |
| **Öğrenci Sayısı**      | Student count                         | Split into **Ortaokul** (middle school) and **Lise** (high school). |
| **Çalışan Sayısı**      | Employee headcount                    | Number of staff working at an outlet.                               |
| **Kantin**              | Canteen                               | Outlet type (schools, universities, staff sites).                  |
| **Şube**                | Outlet / branch                       | Generic word for a revenue-reporting location.                     |
| **Yemekhane**           | Refectory / cafeteria                 | Outlet type (sit-down meal halls).                                 |
| **Firma**               | Company                               | One of the 4 legal entities.                                       |
| **Ortaokul / Lise**     | Middle school / high school           | Sub-breakdown of Öğrenci Sayısı.                                   |

---

## 4. Who uses Komuta

| Person / role          | What they do                                                                 |
|------------------------|------------------------------------------------------------------------------|
| **Özer Kaya** (Owner)  | Reads dashboards, sees all companies, sends reminders.                       |
| **Salih** (Accountant) | Enters monthly data (Stok, Personel Maaşı, Mal Alım, headcounts), reconciles. |
| **Employees**          | Send daily revenue as WhatsApp text. They never log into the web app.       |
| **Operators (you)**    | Deploy, monitor, and maintain the platform.                                 |

---

## 5. High-level architecture (summary)

```
WhatsApp employee message
        │
        ▼
  Meta WhatsApp Cloud API  ──webhook POST──►  Nginx (HTTPS)
                                                  │
                              ┌───────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                        apps/web (Next.js)   apps/api (NestJS)     /webhooks/whatsapp
                        dashboards/UI        REST + SSE            verify HMAC, 200 fast
                              ▲                    │                    │
                              │ SSE + REST         │                enqueue job
                              └────────────────────┘                    ▼
                                                              Redis (BullMQ queue)
                                                                       │
                                                                       ▼
                                                            apps/worker (BullMQ)
                                                  extractMessage → parseAmount →
                                                  resolveStoreFromTokens → decideResolution
                                                                       │
                                                                       ▼
                                                            PostgreSQL 16 (Prisma)
```

- **apps/api** (NestJS) — REST API, auth/RBAC, the WhatsApp webhook, and Server-Sent
  Events (SSE) for live dashboard updates.
- **apps/worker** (BullMQ/Redis) — asynchronous message processing pipeline (parse →
  resolve → store). Keeps the webhook fast.
- **apps/web** (Next.js App Router) — dashboards and operator UI (Tailwind, shadcn/ui,
  Recharts).
- **packages/money** — a standalone, framework-free, 100%-tested amount parser.
- **packages/shared** — enums, Zod schemas, i18n catalog, and the store-resolution logic.
- **packages/config** — brand/company constants.
- **PostgreSQL 16 + Prisma** — the system of record.
- **Redis 7** — BullMQ job queue and cache.

The deep dive (mermaid diagram, resolution decision table, Prisma entity list) is in
[`10_ARCHITECTURE.md`](./10_ARCHITECTURE.md).

---

## 6. Documentation map — where to go next

| Doc                                                        | Read it when you want to…                                            |
|------------------------------------------------------------|----------------------------------------------------------------------|
| [`01_LOCAL_DEVELOPMENT.md`](./01_LOCAL_DEVELOPMENT.md)     | Run Komuta on your laptop.                                           |
| [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md)   | Deploy to the production VPS.                                        |
| [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md)           | Buy a domain, set DNS, get HTTPS.                                    |
| [`04_META_WHATSAPP_SETUP.md`](./04_META_WHATSAPP_SETUP.md) | Connect the WhatsApp Cloud API (the big one).                       |
| [`05_WHATSAPP_TEMPLATES.md`](./05_WHATSAPP_TEMPLATES.md)   | Create & submit message templates.                                  |
| [`06_TELEGRAM_ALERTS.md`](./06_TELEGRAM_ALERTS.md)         | Set up Telegram operator alerts.                                    |
| [`07_USER_GUIDE_TR.md`](./07_USER_GUIDE_TR.md)             | Hand to Özer & Salih (Turkish).                                     |
| [`08_OPERATIONS_RUNBOOK.md`](./08_OPERATIONS_RUNBOOK.md)   | Run day-2 operations.                                               |
| [`09_BACKUP_RESTORE.md`](./09_BACKUP_RESTORE.md)           | Back up and restore the database.                                   |
| [`10_ARCHITECTURE.md`](./10_ARCHITECTURE.md)               | Understand the internals deeply.                                    |
| [`SETUP_CHECKLIST.md`](./SETUP_CHECKLIST.md)               | Do a clean first-time launch, step by step.                         |
| [`DECISIONS.md`](./DECISIONS.md)                           | Understand *why* the architecture is the way it is (ADRs).          |

**New to the project?** Read this file, then `SETUP_CHECKLIST.md`, then follow the
checklist top to bottom.
