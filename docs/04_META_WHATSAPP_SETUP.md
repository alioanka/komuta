# Meta / WhatsApp Cloud API Setup

This is the most involved external setup. Work through it carefully and in order. By the
end, Komuta will receive employee WhatsApp messages and be able to send confirmations.

> **⚡ READ THIS FIRST — our actual scenario (July 2026).** The generic guide below
> (sections 1–10) describes a from-scratch setup. Our real situation is different and
> **much shorter**: the Bakır Kupa business portfolio is already **verified**, a
> **Komuta app already exists** (App ID `1032854465800165`), and the new number
> **+90 533 945 08 84** (Phone number ID `1212503398607413`) already sits in the
> shared **BakirKupa WABA** (`4358223117837235`) next to the BrewIQ number. Follow
> **Section 0** below — it activates Komuta **without touching anything BrewIQ uses**
> and **skips business verification, App Review and app publishing entirely**.
> Domain: **panora.live** → webhook `https://panora.live/webhooks/whatsapp`.

---

## 0. Fast path for the existing shared-WABA setup (RECOMMENDED)

**Why this works:** the webhook callback URL lives on the *App*, not on the WABA or the
phone number. A WABA can be subscribed to by **multiple apps at once, and Meta delivers
every event to each subscribed app's own callback URL**. So the EspressoLab app keeps
receiving events at `brewiq.tech` exactly as today, while the Komuta app *additionally*
receives them at `panora.live`. Each backend filters by `phone_number_id` — Komuta
ignores the BrewIQ number's events (built-in: set `WHATSAPP_PHONE_NUMBER_ID` in `.env`)
and BrewIQ already tolerates the Komuta number's events (it has since the number was
added). **Nothing in the BrewIQ configuration is modified at any step.**

### 0.1 Prerequisites
- Komuta deployed and reachable at `https://panora.live` with a valid TLS certificate
  (docs 02 + 03). The webhook verification handshake needs the live endpoint.
- `.env` on the server already contains a strong random `META_VERIFY_TOKEN`
  (`openssl rand -hex 24`).

### 0.2 Collect the Komuta app credentials
1. Open <https://developers.facebook.com/apps/> → select the **Komuta** app.
2. Left sidebar → **App settings → Basic**:
   - **App ID** → `META_APP_ID` (`1032854465800165`)
   - **App secret** → click **Show** → `META_APP_SECRET`

### 0.3 Configure the Komuta app webhook
1. In the Komuta app dashboard, open the WhatsApp webhook settings. Depending on which
   dashboard UI Meta shows you, it is either:
   - Left sidebar → **WhatsApp → Configuration**, or
   - **Dashboard → Use cases → "Connect with customers through WhatsApp" → Customize →
     Webhooks** (the new use-case UI).
2. Under **Webhook**: Callback URL = `https://panora.live/webhooks/whatsapp`,
   Verify token = the value of `META_VERIFY_TOKEN` → **Verify and save**.
   (Komuta answers the `hub.challenge` handshake automatically once deployed.)
3. In the **Webhook fields** table, **Subscribe** to the `messages` field.
   Do NOT touch the EspressoLab app's webhook page.

### 0.4 Create a system-user token for Komuta
1. <https://business.facebook.com/settings> → make sure **Bakır Kupa** portfolio is
   selected → **Users → System users** → **Add** → name `Komuta Bot`, role **Admin**.
2. On `Komuta Bot` → **Add assets**:
   - **Apps → Komuta** → toggle **Manage app** (full control).
   - **WhatsApp accounts → BakirKupa** → toggle **Manage WhatsApp business account**.
3. **Generate new token** → App: **Komuta** → Expiration: **Never** → check
   `whatsapp_business_messaging` + `whatsapp_business_management`
   (+ `whatsapp_business_manage_events` optional) → **Generate token** → copy it
   **once** → `WHATSAPP_ACCESS_TOKEN`.

### 0.5 Subscribe the Komuta app to the shared WABA (one command)
```bash
curl -X POST "https://graph.facebook.com/v23.0/4358223117837235/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
# verify — must list BOTH apps (EspressoLab Notifications AND Komuta):
curl "https://graph.facebook.com/v23.0/4358223117837235/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```
This *adds* a subscription; the EspressoLab subscription is untouched.

### 0.6 Register the number for Cloud API sending
1. **WhatsApp Manager** (<https://business.facebook.com/wa/manage/phone-numbers/>) →
   account **BakirKupa** → row **+90 533 945 08 84** → gear icon → **Two-step
   verification** → set a 6-digit PIN.
2. Register:
```bash
curl -X POST "https://graph.facebook.com/v23.0/1212503398607413/register" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","pin":"<your-6-digit-pin>"}'
```

### 0.7 (Optional but recommended) display name → "Komuta"
WhatsApp Manager → Phone numbers → the new number → gear → **Profile** → change the
display name from `BakirKupa` to `Komuta` → automatic review (minutes to ~48h). Display
name state does **not** block messaging (the BrewIQ number runs with a *rejected* name).
Avoid personal names — that's why `Ali` was rejected.

### 0.8 Fill `.env` and restart
```
META_APP_ID=1032854465800165
META_APP_SECRET=<from 0.2>
META_VERIFY_TOKEN=<yours>
WHATSAPP_PHONE_NUMBER_ID=1212503398607413
WHATSAPP_BUSINESS_ACCOUNT_ID=4358223117837235
WHATSAPP_ACCESS_TOKEN=<from 0.4>
```
`WHATSAPP_PHONE_NUMBER_ID` **must** be set in this shared-WABA setup — it is what makes
Komuta ignore the BrewIQ number's webhook events.

### 0.9 Test
Send a WhatsApp text to **+90 533 945 08 84** → it must appear in Komuta → *Mesajlar*.
Reply from the dashboard within 24h (free-form). Then create Komuta's UTILITY templates
under the BakirKupa WABA (doc 05) — they coexist with the `brewiq_*` templates.

### What you get to skip in this scenario
| Generic step | Status |
|---|---|
| Business verification (section 7) | ✅ already done for Bakır Kupa |
| App Review / Advanced Access | ✅ not needed — own-business WABA |
| Publishing / Live mode (section 8) | ✅ not needed — BrewIQ runs unpublished too |
| Payment method (section 3) | ✅ already on the WABA (paid templates bill there) |
| New number purchase / OTP | ✅ number already added & verified in the WABA |

### Alternative: full isolation (only if you later want a separate WABA)
Move the number into its own WABA under the **verified Bakır Kupa** portfolio (NOT the
empty unverified "Komuta" portfolio — that would trigger business verification again):
delete **only +90 533 945 08 84** from the BakirKupa WABA (trash icon — never touch
+90 532 335 15 69), then Komuta app → WhatsApp → API Setup → **Add phone number** (new
OTP via SIM, new Phone number ID, add the Visa to the new WABA in Billing & payments).
More clicks, more risk, no functional gain today — the fast path above is preferred.

> **Key facts (2025/2026), do not deviate:**
> - The old **On-Premises API was deprecated in October 2025**. We use the
>   **Cloud API** only — it's hosted by Meta, no media server to run.
> - All calls go to the Graph API base: `https://graph.facebook.com/{version}/`, where
>   `{version}` comes from **`META_GRAPH_VERSION`** (default **`v23.0`**, pinned in
>   `.env`).
> - We use a **brand-new phone number** that has **never** been on WhatsApp or WhatsApp
>   Business. Because it's brand new, there is **no migration step** — skip anything you
>   read elsewhere about "migrating an existing number".

The `.env` values you will produce in this doc:

| `.env` variable                    | Where it comes from                                  |
|------------------------------------|------------------------------------------------------|
| `META_GRAPH_VERSION`               | Already `v23.0` (leave as is unless upgrading)        |
| `META_APP_ID`                      | App dashboard → Settings → Basic                     |
| `META_APP_SECRET`                  | App dashboard → Settings → Basic (App secret)        |
| `META_VERIFY_TOKEN`                | **You invent** this random string                    |
| `WHATSAPP_PHONE_NUMBER_ID`         | WhatsApp → API Setup                                  |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`     | WhatsApp → API Setup (WABA ID)                       |
| `WHATSAPP_ACCESS_TOKEN`            | System User **permanent** token                      |

---

## 1. Create a Meta Business Portfolio and Developer account

1. Go to <https://business.facebook.com/> and create a **Business Portfolio** (formerly
   "Business Manager") for Özer's business if one doesn't exist. Fill in the legal
   business name and details.
2. Go to <https://developers.facebook.com/>, log in with the same account, and complete
   **developer registration** (verify email/phone).

---

## 2. Create a Business-type app and add WhatsApp

1. At <https://developers.facebook.com/apps/>, click **Create App**.
2. Choose the **Business** app type (this is required for WhatsApp).
3. Name it (e.g. "Komuta WhatsApp"), link it to your **Business Portfolio**, and create.
4. On the app dashboard, find **WhatsApp** in the product list and click **Set up**.

After adding WhatsApp, go to **App Settings → Basic** and copy:

- **App ID** → `META_APP_ID`
- **App secret** (click "Show") → `META_APP_SECRET`

> `META_APP_SECRET` is used to verify the `X-Hub-Signature-256` HMAC on every inbound
> webhook. Keep it secret.

---

## 3. Add the brand-new phone number

In **WhatsApp → API Setup**:

1. You'll see a Meta-provided **test number** by default. For production, click
   **Add phone number** and register your **brand-new** number (one never used on
   WhatsApp or WhatsApp Business — no migration needed).
2. **Add a payment method** to the WhatsApp Business Account. This is **required** even
   though most of our usage is free (see [`05_WHATSAPP_TEMPLATES.md`](./05_WHATSAPP_TEMPLATES.md)
   on the free 24-hour window).
3. Set the **display name** (the name customers see, e.g. "Komuta" / the business name).
   Display names go through a short review.
4. Verify the number via the SMS/voice code Meta sends.

From **API Setup**, copy:

- **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- **WhatsApp Business Account ID (WABA ID)** → `WHATSAPP_BUSINESS_ACCOUNT_ID`

---

## 4. Enable two-step verification PIN and register the number

The Cloud API requires a **6-digit two-step verification PIN** for the number, and the
number must be **registered** for Cloud API use.

1. Choose a 6-digit PIN and store it safely (e.g. `123456` — pick your own).
2. Register the number via the Graph API. You need a **token** for this — you can use a
   temporary token from API Setup for this one-off call, or the permanent token from
   §5 once you have it.

```bash
curl -X POST \
  "https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>/register" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "messaging_product": "whatsapp",
        "pin": "123456"
      }'
```

A successful response is `{"success": true}`. If the number already requires a PIN you
previously set, supply that same PIN.

---

## 5. Create a System User and a PERMANENT access token

The temporary tokens shown in API Setup **expire in 24 hours** — useless for a server.
Create a **System User** with a **permanent** token.

1. Go to **Business Settings** (<https://business.facebook.com/settings/>) →
   **Users → System Users**.
2. Click **Add**, name it (e.g. "komuta-server"), role **Admin** (or Employee with the
   right asset access).
3. Select the system user → **Assign assets** → choose your **WhatsApp Account (WABA)**
   → grant **Full control**.
4. Click **Generate new token**:
   - Select your **app** ("Komuta WhatsApp").
   - Set token expiration to **Never** (permanent).
   - Select these scopes:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
     - `whatsapp_business_manage_events`
   - Generate, then **copy the token immediately** (it's shown only once) →
     `WHATSAPP_ACCESS_TOKEN`.

> Store this token like a password. If it leaks, revoke it in System Users and generate
> a new one (see token rotation in [`08_OPERATIONS_RUNBOOK.md`](./08_OPERATIONS_RUNBOOK.md)).

Quick test that the token + phone number ID work (sends nothing; just reads the number):

```bash
curl -s \
  "https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>?fields=display_phone_number,verified_name,quality_rating" \
  -H "Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>"
```

---

## 6. Configure the webhook

This is how employee messages reach Komuta.

> **Prerequisite:** HTTPS must already be live (see
> [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md)). The webhook URL must be HTTPS.

1. First, choose a random **verify token** and put it in `.env` as `META_VERIFY_TOKEN`
   (e.g. `openssl rand -hex 16`). Deploy/restart so the API knows it.
2. In the app dashboard → **WhatsApp → Configuration** (or **Webhooks**):
   - **Callback URL:** `https://komuta.app/webhooks/whatsapp`
   - **Verify token:** the exact `META_VERIFY_TOKEN` value.
   - Click **Verify and save**. Meta sends a `GET` with `hub.challenge`; Komuta echoes
     it back. If verification fails, see Troubleshooting below.
3. Under **Webhook fields**, click **Manage** and **subscribe** to:
   - **`messages`** (inbound messages) — **required**.
   - **message status** updates (delivered/read/failed) — recommended.

> Komuta validates the `X-Hub-Signature-256` header on each POST using
> `META_APP_SECRET`. If that header doesn't match, the request is rejected.

---

## 7. Complete Meta Business Verification

For production message volume (beyond a small test allowance), Meta requires
**Business Verification**.

1. Business Settings → **Security Center** → **Start Verification**.
2. Provide the legal business details and supporting documents (e.g. business
   registration, utility bill, or other proof Meta lists for your country).
3. **Timeline:** verification typically takes a few business days but can take longer.
4. **Rejection risk:** mismatched name/address/phone between your documents and your
   Business Portfolio is the most common rejection cause. Make them match exactly. You
   can re-submit after fixing.

Until verified, you can only message a small list of **test recipients** you add
manually (see Troubleshooting).

---

## 8. Switch the app to Live mode

In the app dashboard, top bar toggle **App Mode: Development → Live**. In Live mode the
webhook delivers real messages and you can message any opted-in user (subject to your
messaging limits and verification status).

---

## 9. End-to-end test

### Inbound

1. From a normal personal WhatsApp, send a text (e.g. `12345 73256,76`) to the business
   number.
2. Watch the API/worker logs (`docker compose logs -f api worker`). You should see the
   webhook POST and the worker processing the amount.

### Outbound (a free reply within the open window)

Because the employee just messaged you, the **24-hour customer-service window** is open,
so a free-form reply is free. Send one:

```bash
curl -X POST \
  "https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
        "messaging_product": "whatsapp",
        "to": "<RECIPIENT_WA_ID_E164_NO_PLUS>",
        "type": "text",
        "text": { "body": "Komuta test ✅" }
      }'
```

A `messages` array with an ID in the response means it sent.

---

## 10. Troubleshooting

| Symptom                                                  | Cause & fix                                                                                                  |
|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `(#190) Access token has expired`                        | You used a **temporary** token (24h). Use the **permanent System User token** (§5) for `WHATSAPP_ACCESS_TOKEN`. |
| `(#131030)` recipient not in allowed list                | Before Business Verification / in Dev mode you can only message **test recipients**. Add the number under WhatsApp → API Setup → "To" recipients. |
| Webhook "Verify and save" fails                          | `META_VERIFY_TOKEN` in `.env` must **exactly** match the value typed in the Meta UI; the API must be redeployed; the GET handshake must echo `hub.challenge`. |
| Webhook callback rejected / not reachable                | The URL **must be HTTPS** with a valid cert (doc 03). Test `curl -I https://komuta.app/webhooks/whatsapp`.   |
| Inbound POSTs arrive but are rejected (401/403)          | `X-Hub-Signature-256` mismatch — `META_APP_SECRET` in `.env` is wrong/empty. Copy it from App Settings → Basic and redeploy. |
| No inbound messages at all                               | Confirm you **subscribed to the `messages` field** (§6) and the app is **Live** (§8).                       |
| `register` call fails                                    | The PIN must be the number's current two-step PIN; enable two-step verification first (§4).                  |

Once messages flow, set up the message templates in
[`05_WHATSAPP_TEMPLATES.md`](./05_WHATSAPP_TEMPLATES.md).
