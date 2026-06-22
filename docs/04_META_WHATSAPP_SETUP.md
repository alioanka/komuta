# Meta / WhatsApp Cloud API Setup

This is the most involved external setup. Work through it carefully and in order. By the
end, Komuta will receive employee WhatsApp messages and be able to send confirmations.

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
