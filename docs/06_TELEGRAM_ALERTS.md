# Telegram Operator Alerts

Komuta sends **operational alerts** (e.g. "no messages received in N minutes",
"webhook signature failures", "anomalous revenue") to a **Telegram** chat so operators
get a fast heads-up. Telegram is free and instant — perfect for ops alerting.

This produces two `.env` values:

| `.env` variable             | What it is                                  |
|-----------------------------|---------------------------------------------|
| `TELEGRAM_BOT_TOKEN`        | The bot's API token (from @BotFather)       |
| `TELEGRAM_DEFAULT_CHAT_ID`  | The chat where alerts are delivered         |

---

## 1. Create a bot with @BotFather

1. In Telegram, search for **@BotFather** (the official bot, blue checkmark) and open it.
2. Send `/newbot`.
3. Give it a **name** (display name, e.g. `Komuta Alerts`).
4. Give it a **username** ending in `bot` (must be unique, e.g. `komuta_ops_bot`).
5. BotFather replies with a **token** like:

   ```
   123456789:AAH-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   Copy it → `TELEGRAM_BOT_TOKEN`. Treat it as a secret (anyone with it can send as your
   bot).

---

## 2. Find the chat ID

The bot can only message a chat **after** that chat has interacted with it. Decide where
alerts should go:

### Option A — a direct chat (alerts to one person)

1. Open your new bot in Telegram (use the `t.me/<username>` link BotFather gave you) and
   press **Start** / send any message like `hi`.
2. Fetch updates to read the chat ID:

   ```bash
   curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
   ```

3. In the JSON, find `"chat":{"id":...}`. For a private chat it's a **positive** number,
   e.g. `987654321` → `TELEGRAM_DEFAULT_CHAT_ID`.

### Option B — a group (alerts to a team)

1. Create a Telegram group, **add your bot** to it.
2. Send a message in the group (mention the bot or just any text).
3. Run the same `getUpdates` call. A group chat ID is **negative**, e.g.
   `-1001234567890` → `TELEGRAM_DEFAULT_CHAT_ID`.

> If `getUpdates` returns an empty `result`, send the bot/group another message and try
> again. (Also note: if a webhook is set on the bot, `getUpdates` won't return data —
> not an issue here since Komuta polls Telegram only for setup.)

---

## 3. Test an alert

Send a test message directly via the API (replace the token and chat id):

```bash
curl -s -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage" \
  -d chat_id="<TELEGRAM_DEFAULT_CHAT_ID>" \
  -d text="Komuta test alert ✅"
```

A `{"ok":true,...}` response and the message appearing in the chat means it works.

You can also send formatted text:

```bash
curl -s -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage" \
  -d chat_id="<TELEGRAM_DEFAULT_CHAT_ID>" \
  -d parse_mode="HTML" \
  -d text="<b>Komuta</b>: webhook OK ✅"
```

---

## 4. Put the values in `.env` and restart

```dotenv
TELEGRAM_BOT_TOKEN=123456789:AAH-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_DEFAULT_CHAT_ID=987654321
```

Then restart the services that send alerts:

```bash
docker compose restart api worker
```

---

## 5. Troubleshooting

| Symptom                                  | Fix                                                                         |
|------------------------------------------|-----------------------------------------------------------------------------|
| `{"ok":false,...401 Unauthorized}`       | Wrong/typo'd `TELEGRAM_BOT_TOKEN`.                                          |
| `{"ok":false,...400 chat not found}`     | Wrong `TELEGRAM_DEFAULT_CHAT_ID`, or the chat never messaged the bot first. |
| `403 bot was blocked by the user`        | The recipient blocked the bot; unblock or use a different chat/group.       |
| `getUpdates` returns empty               | Send the bot a message first; ensure no webhook is set on the bot.          |
