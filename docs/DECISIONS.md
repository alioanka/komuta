# Architecture Decision Records (ADRs)

This is a running log of significant architectural decisions for Komuta. Each ADR is
short and immutable once **Accepted** — if a decision changes, add a new ADR that
supersedes the old one rather than editing history.

**Format:** Title · Status · Context · Decision · Consequences.

---

## ADR-0001 — Technology stack

**Status:** Accepted

**Context.** Komuta is a single-tenant internal operations tool for one business owner,
intended to run cheaply and be maintained by a small team (often one operator) on a
single VPS. It must ingest WhatsApp messages asynchronously, enforce role-based access,
and present live dashboards. We wanted one language end-to-end to minimize context
switching.

**Decision.** Use a **TypeScript monorepo** (pnpm + Turborepo) with:
- **NestJS** for the API (REST, webhook, SSE, RBAC guards),
- **Next.js** (App Router) for the web UI,
- **BullMQ + Redis** for asynchronous message processing,
- **Prisma + PostgreSQL 16** for the data layer,
- Deployed via **Docker Compose behind Nginx** on a single Contabo VPS.

**Consequences.**
- ✅ One language and one repo simplify development, testing, and hiring.
- ✅ Async ingestion (BullMQ) keeps the WhatsApp webhook fast and lets the worker scale
  independently.
- ✅ NestJS guards give clean RBAC; Prisma gives type-safe DB access.
- ✅ Single-VPS Docker Compose is cheap and easy to operate/back up.
- ⚠️ Not built for horizontal multi-node scale — acceptable for this workload; revisit
  only if volume outgrows one VPS.

---

## ADR-0002 — Money engine as a standalone, framework-free, fully-tested package

**Status:** Accepted

**Context.** The single most critical operation is converting an employee's free-text
amount (`73256,76`, `73.256,76`, `73256.76`, `73,256.76`, optionally prefixed by a store
token) into an exact monetary value. A parsing mistake silently corrupts revenue data.
Floating-point math is a known source of subtle errors.

**Decision.** Implement amount parsing in **`packages/money`**, a **framework-free**
package with **100% test coverage**, prioritizing **determinism over cleverness**.
Amounts are handled with exact precision (integer minor units / precise decimal), never
as raw floats. The package depends on nothing from NestJS/Next.js and is reused by both
api and worker.

**Consequences.**
- ✅ Exhaustively testable in isolation; the same input always yields the same exact value.
- ✅ Reusable across services without framework coupling.
- ✅ Locale ambiguity (Turkish vs. Anglo decimal separators) is handled in one audited place.
- ⚠️ New edge-case formats require adding tests first, by design — slightly slower to
  extend, but safe.

---

## ADR-0003 — Idempotency via WhatsApp message id deduplication

**Status:** Accepted

**Context.** Meta's WhatsApp Cloud API **retries** webhook deliveries if it doesn't get a
prompt `200`, so the same message can arrive more than once. Double-processing would
create duplicate revenue records.

**Decision.** Treat the **WhatsApp message id** (`wamid...`) as the idempotency key. On
intake, record the message id; if it has already been seen, acknowledge and stop without
re-processing.

**Consequences.**
- ✅ Webhook retries and manual replays are safe — no duplicate revenue.
- ✅ Enables a simple "replay the payload" re-processing/testing workflow.
- ⚠️ Requires storing seen message ids (small cost); a genuinely new message must carry a
  new id.

---

## ADR-0004 — RBAC as `resource:action` permissions with role map, per-user overrides, and scope

**Status:** Accepted

**Context.** Different users need different access: the owner (Özer) sees everything; the
accountant (Salih) enters monthly data; future staff may need narrower access (e.g. one
company or brand). Hard-coding roles is too rigid.

**Decision.** Model authorization as fine-grained **`resource:action` permissions** (e.g.
`revenue:read`, `monthly:write`). Roles map to permission sets; individual users can have
**per-user overrides** (grant/deny), and access is constrained by a **scope** (e.g.
company/brand/outlet). API access is enforced by **NestJS guards**.

**Consequences.**
- ✅ Flexible and auditable; new roles/permissions don't require structural changes.
- ✅ Scope lets us limit a user to specific companies/outlets.
- ⚠️ More moving parts than a simple role enum — mitigated by a clear default role map.

---

## ADR-0005 — Internationalization: Turkish-primary via a shared catalog

**Status:** Accepted

**Context.** All end users (owner, accountant, employees) are Turkish speakers, and the
business domain uses Turkish terms (Ciro, Stok, Şube, Yemekhane…). English is needed only
secondarily (e.g. EN template variants, developer-facing).

**Decision.** Keep an **i18n catalog in `packages/shared`** with **Turkish as the primary
language**. UI strings, enums' display labels, and WhatsApp template language variants
draw from this shared source.

**Consequences.**
- ✅ Consistent Turkish terminology across UI, messages, and docs.
- ✅ Single place to add EN (or other) translations.
- ⚠️ Contributors must add catalog entries rather than hard-coding strings.

---

## ADR-0006 — Pin the Graph API version via environment

**Status:** Accepted

**Context.** Meta's Graph API is versioned and changes over time; the On-Premises API was
deprecated in October 2025, leaving the Cloud API. Unpinned versions risk silent
behavior changes.

**Decision.** Pin the Graph API version with the **`META_GRAPH_VERSION`** env var, default
**`v23.0`**. All Cloud API calls use `https://graph.facebook.com/{META_GRAPH_VERSION}/`.

**Consequences.**
- ✅ Predictable API behavior; upgrades are a deliberate, single-variable change.
- ✅ Easy to test a new version in staging before rolling it forward.
- ⚠️ Requires periodically bumping the version before Meta deprecates older ones.
