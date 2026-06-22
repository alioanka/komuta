# WhatsApp Message Templates

Komuta sends a few **structured messages** back to employees — confirmations, reminders,
requests. WhatsApp requires these to be **pre-approved templates** when they are sent
**outside** an open conversation window. This doc explains how to create, submit, and
wire them into Komuta, and — importantly — how to keep cost at **basically zero**.

---

## 1. The 24-hour window (why most of our messages are FREE)

WhatsApp has a **24-hour customer-service window**: when a user messages your business,
a 24-hour window opens during which you can reply with **free-form messages** and
**utility templates for free**.

**Komuta's usage pattern fits this perfectly:** employees message their revenue **first,
every day**. That opens the window. So:

- ✅ The **revenue confirmation** reply → sent inside the open window → **FREE**.
- ✅ A clarification ("which outlet?") right after their message → **FREE**.
- 💸 A template sent to someone **outside** their window (e.g. a reminder to an employee
  who hasn't messaged today) → **billed**.

> **Pricing model (since 1 July 2025):** WhatsApp bills **per delivered message**, priced
> by **template category** and **recipient country**. Utility and service messages within
> an open window are free; messages opened by a business outside a window cost money.

**Operating rule for Komuta: keep template sends minimal.** Prefer replying inside the
open window. Only the **missing-revenue reminder** and similar "we contact them first"
messages incur cost — and those are low volume.

---

## 2. The templates Komuta uses

All are **UTILITY** category (transactional, not marketing), submitted in **Turkish (TR)**
and **English (EN)**.

| Template name (suggested)    | Purpose                                              | Sent inside window? |
|------------------------------|------------------------------------------------------|---------------------|
| `revenue_confirmation`       | Confirm a recorded daily revenue                     | Yes → free          |
| `missing_revenue_reminder`   | Remind an outlet that hasn't reported today          | No → billed         |
| `store_id_request`           | Ask which outlet a message belongs to                | Usually yes → free  |
| `manager_confirmation`       | Ask a manager to confirm a new sender→outlet pairing | Maybe → varies      |
| `daily_summary`              | Daily total summary to owner/manager                 | No → billed         |

### `revenue_confirmation` (the canonical example)

**TR body:**

```
✅ {{1}} için {{2}} TL cironuz {{3}} tarihine kaydedildi.
```

Where `{{1}}` = outlet name, `{{2}}` = amount, `{{3}}` = date.

**EN body:**

```
✅ Your revenue of {{2}} TL for {{1}} has been recorded for {{3}}.
```

> Variables are positional (`{{1}}`, `{{2}}`, …). **Keep the same variable order across
> TR and EN** so Komuta can pass one ordered array of values to either language.

---

## 3. Create & submit a template in WhatsApp Manager

1. Go to **WhatsApp Manager** (<https://business.facebook.com/wa/manage/>) → **Account
   tools → Message templates** → **Create template**.
2. **Category:** choose **Utility**.
3. **Name:** lowercase + underscores, e.g. `revenue_confirmation`. (Names are
   immutable; the name is what Komuta references — see §5.)
4. **Language:** add **Turkish**. Repeat the whole flow to also add **English** (a
   template can hold multiple languages under one name).
5. **Body:** paste the body text. Insert variables with the **Add variable** button so
   they appear as `{{1}}`, `{{2}}`, …
6. **Sample values:** provide example values for each variable (e.g. `Çamlıca`,
   `73.256,76`, `22.06.2026`). Meta uses these to review.
7. **Submit for review.**

### Approval

- Review is usually **minutes to a few hours**, sometimes up to 24h.
- **Approved** → usable immediately.
- **Rejected** → fix per the reason (common: wrong category — promotional content in a
  Utility template; or variable misuse) and resubmit.

Repeat for each of the five templates, in both TR and EN.

---

## 4. Sending a template (reference)

When Komuta must send a template (outside the window), the Graph API call looks like:

```bash
curl -X POST \
  "https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "messaging_product": "whatsapp",
        "to": "<RECIPIENT_WA_ID>",
        "type": "template",
        "template": {
          "name": "revenue_confirmation",
          "language": { "code": "tr" },
          "components": [
            { "type": "body",
              "parameters": [
                { "type": "text", "text": "Çamlıca" },
                { "type": "text", "text": "73.256,76" },
                { "type": "text", "text": "22.06.2026" }
              ]
            }
          ]
        }
      }'
```

The `language.code` is `tr` or `en`; the `parameters` array is in `{{1}}`,`{{2}}`,`{{3}}`
order.

---

## 5. Map approved templates into Komuta's `MessageTemplate` table

Komuta keeps a `MessageTemplate` table so code refers to a **logical key** while the
approved Meta name/language is stored as data (no redeploy needed to change them).

For each approved template, record:

| Column (conceptual)   | Example value             | Notes                                            |
|-----------------------|---------------------------|--------------------------------------------------|
| `key`                 | `revenue_confirmation`    | Stable internal key used by Komuta code/logic    |
| `metaName`            | `revenue_confirmation`    | The **exact** approved template name in Meta     |
| `language`            | `tr` (and a row for `en`) | Must match the approved language code            |
| `category`            | `UTILITY`                 | For documentation/auditing                       |
| `variableCount`       | `3`                       | Number of `{{n}}` placeholders                   |
| `status`              | `APPROVED`                | Track approval state                             |

How to enter them depends on the build: either via the **operator UI** (a "Templates"
admin screen in the web app) or a small seed/SQL. The rule is simple — **the `metaName`
+ `language` in this table must exactly match what Meta approved**, or sends will fail
with a "template not found" error.

> After changing template rows, no redeploy is needed — Komuta reads them at send time.
> But the **template must be APPROVED in Meta** before it can be sent.

---

## 6. Cost-control checklist

- [ ] All templates are **UTILITY** (not Marketing) — avoids higher pricing and rejections.
- [ ] Confirmations are sent **as replies inside the open 24h window** → free.
- [ ] Reminders (`missing_revenue_reminder`) are the only routinely-billed messages — keep
      them once-per-day, per missing outlet, after `REPORTING_CUTOFF_LOCAL`.
- [ ] Don't send `daily_summary` to large lists; one or two recipients.
