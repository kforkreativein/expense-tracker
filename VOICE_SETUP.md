# Voice entry setup for Money Buddy

Speak an entry instead of typing it, and ask questions about your spending out loud.
Everything below is a one-time setup. There are only **two** things you must do:
add the Groq key, and run one SQL query.

---

## What you have to do yourself

### Step 1 — Get a Groq API key

1. Go to [https://console.groq.com](https://console.groq.com) and sign in (free tier is fine).
2. Open **API Keys** in the left sidebar.
3. Click **Create API Key**, give it the name `money-buddy`.
4. Copy the key. It starts with `gsk_`.
5. Keep it somewhere private for the next step. Groq only shows it once.

> Never paste this key into the app, a chat, or a screenshot. It is the one secret
> here that can cost you money if someone else gets it.

### Step 2 — Add the key to Vercel

1. Vercel → your Money Buddy project → **Settings** → **Environment Variables**.
2. Add:

| Name | Value |
|------|-------|
| `GROQ_API_KEY` | The `gsk_...` key from step 1 |

3. Tick **Production** (and **Preview** if you use preview links).
4. Click **Save**.
5. Go to **Deployments** → open the latest one → **⋯** → **Redeploy**.

The name must be exactly `GROQ_API_KEY`, with **no** `NEXT_PUBLIC_` in front. That
prefix would publish the key to every visitor's browser.

### Step 3 — Run one SQL query in Supabase

This creates the table for the new spending categories.

1. Supabase → your project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/add_spend_categories_aug2026.sql` from this repo.
3. Copy all of it, paste it in, click **Run**.
4. You should see **Success**. Running it twice is harmless.

If you skip this step the app still works, but Food / Transport / Shopping stay on
your phone only and will not sync to your other devices.

### Step 4 — Allow the microphone

1. Open Money Buddy and hold the 🎤 button once.
2. Your phone asks for microphone access → tap **Allow**.

On iPhone, if you use the home-screen app, allow it there too — the home-screen app
and Safari ask separately.

That's everything. The 🎤 button appears next to **Add** automatically once the key
is live. If you don't see it, the key isn't set yet (see Troubleshooting).

---

## Optional — Local development

Add the key to `.env.local` next to your Supabase keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=gsk_your_key_here
```

Then restart `npm run dev`. The microphone needs a secure connection, and
`http://localhost` counts as secure, so it works while developing.

## Optional — Double-tap the back of your iPhone to record

Same idea as the existing add-entry shortcut, pointed at the voice URL:

1. **Shortcuts** app → **+** → **Add Action** → search **Open URL**.
2. URL: `https://your-money-buddy-url/?action=voice`
3. Name it **Talk to Money Buddy**, then save.
4. **Settings** → **Accessibility** → **Touch** → **Back Tap** → **Double Tap** →
   pick that shortcut.

Now a double tap on the back of the phone opens the app already listening.

---

## How to use it

| You want to | Do this |
|-------------|---------|
| Record one entry | **Hold** the 🎤, speak, let go |
| Record without holding | **Double-tap** the 🎤, speak, tap once to stop |
| Cancel | Tap **Cancel** in the listening bar |
| Ask a question | Hold the 🎤 and ask it |

Nothing saves until you confirm. One amount opens the normal entry form already
filled in. Several amounts in one sentence become a stack of cards you can edit,
with a single **Save all** button.

You can speak English, Hindi, or a mix:

- "Spent 250 on chai from HDFC"
- "Chai pe 250 kharch kiye"
- "Got 20000 salary in Yes Bank"
- "Kal 300 ka auto aur 150 ka lunch" (two entries, dated yesterday)
- "5000 SIP in mutual fund"
- "How much did I spend on food this month?"
- "Pichle mahine kitna kharch hua?"

Limits: 20 seconds per recording, and it needs an internet connection. Everything
else in Money Buddy keeps working offline as before.

---

## How it is kept secure

Worth knowing, since the app now talks to a paid service for the first time.

| Risk | What protects you |
|------|-------------------|
| Someone steals the Groq key | The key only ever exists on the server. It is never sent to the browser, so it cannot be read from the app, the page source, or network tools. |
| A stranger uses your endpoint | Every request must carry a valid Supabase login token, which the server checks with Supabase on each call. No token, no transcription. |
| Another website calls it using your browser | Requests from any other origin are refused. |
| A huge file runs up your bill | Audio is capped at 4 MB and 20 seconds, and non-audio formats are rejected before anything is sent to Groq. |
| A loop burns your quota | Maximum 30 voice requests per 10 minutes per account. |
| Your financial data leaking | Only wallet and category **names** are sent, never amounts, balances or history. Questions are answered on your phone from local data. |
| The AI inventing a wrong entry | Everything that comes back is re-checked on your phone: unknown wallets and categories are dropped, amounts must be sensible whole rupees, and future dates are pulled back to today. A bad response can only ever leave a field blank — never save a wrong number. |
| Recordings being kept | Audio is passed straight through in memory and never written to disk, a database, or a log. |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No 🎤 button at all | `GROQ_API_KEY` is missing or the app was not redeployed after adding it. Check Vercel → Settings → Environment Variables, then redeploy. |
| "Microphone blocked" | Allow mic access for the site. iPhone: Settings → Safari → Microphone. Chrome: tap the padlock in the address bar. |
| "Please log in again" | Your cloud session expired. Log out and back in. |
| "Recording needs a secure connection" | Open the app over `https://`, not a plain `http://` address. |
| "Too many voice entries in a row" | Wait a minute and try again. |
| "Voice service is busy" | Groq is rate-limiting or down. Try again shortly; the free tier has hourly limits. |
| It hears the wrong amount | Say the number on its own, e.g. "two fifty" rather than "two hundred and fifty rupees only". You can always fix it before saving. |
| It picks the wrong wallet | Name the wallet out loud ("from HDFC"). With no wallet named it uses the one you use most. |
| Food / Transport not syncing | The SQL query in step 3 has not been run yet. |

## Changing the models (optional)

Defaults are `whisper-large-v3` for listening and `openai/gpt-oss-20b` for
understanding. Override them with environment variables if you ever want to:

| Name | Purpose |
|------|---------|
| `GROQ_STT_MODEL` | Speech-to-text model. `whisper-large-v3-turbo` is faster and slightly less accurate. |
| `GROQ_PARSE_MODEL` | The model that fills in the fields. |
