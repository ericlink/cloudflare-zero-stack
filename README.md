# Feedback Wall

A small, deployable **indie-hacker stack** sample (text-only for now):

| Layer | Service |
| --- | --- |
| Frontend | Cloudflare Workers **Static Assets** (`public/`) |
| API | Cloudflare **Workers** + [Hono](https://hono.dev) |
| Database | Cloudflare **D1** (SQLite) |
| Email | [Resend](https://resend.com) → notifies `NOTIFY_EMAIL` on new posts |

> **Note:** R2 image uploads are **skipped for now** (no `[[r2_buckets]]` binding). The wall accepts name + message only. The D1 `image_key` column remains nullable for a future re-enable.

Public visitors see recent feedback (newest first) and can post a name and message (≤1000 chars). Each create writes to D1, then emails the owner via Resend (skipped with a warning if `RESEND_API_KEY` is unset).

```
Browser ──► Worker (Hono)
              ├── GET  /           → static HTML/CSS/JS (Assets)
              ├── GET  /api/feedback
              └── POST /api/feedback  → D1 + Resend
```

## Project layout

```
feedback-wall/
├── public/                 # Static UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── index.ts            # Hono routes
│   ├── email.ts            # Resend helper
│   └── types.ts
├── migrations/
│   └── 0001_create_feedback.sql
├── wrangler.toml
├── .dev.vars.example
├── package.json
└── README.md
```

## Prerequisites

- Node.js **20+** (Node **22+** recommended — current Wrangler requires ≥22)
- A [Cloudflare](https://dash.cloudflare.com) account (free tier is enough)
- Optional: a [Resend](https://resend.com) account + API key for email

You do **not** need Cloudflare Pages separately — this is a single Worker with Assets (Pages-compatible mindset, one deploy).

## Local setup

```bash
cd feedback-wall
npm install

# Local secrets / overrides (optional email)
cp .dev.vars.example .dev.vars
# edit .dev.vars — RESEND_API_KEY can be left blank; posts still save

# Apply D1 schema to the local (Miniflare) database
npm run db:migrate:local

# Start the Worker + assets
npm run dev
```

Open the URL Wrangler prints (usually `http://127.0.0.1:8787`).

| Script | What it does |
| --- | --- |
| `npm run dev` | `wrangler dev` — local Worker + Assets + D1 sim |
| `npm run deploy` | Deploy Worker + Assets to Cloudflare |
| `npm run db:migrate:local` | Apply migrations to **local** D1 |
| `npm run db:migrate:remote` | Apply migrations to **remote** D1 |

## Cloudflare account steps (one-time)

Do these in the dashboard or CLI before a real deploy. Placeholders in `wrangler.toml` must be replaced.

### 1. Log in

```bash
npx wrangler login
```

### 2. Create a D1 database

```bash
npx wrangler d1 create feedback-wall-db
```

Copy the printed `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "feedback-wall-db"
database_id = "<paste-id-here>"
migrations_dir = "migrations"
```

Apply migrations remotely:

```bash
npm run db:migrate:remote
```

### 3. Set `NOTIFY_EMAIL`

Default in `wrangler.toml`:

```toml
[vars]
NOTIFY_EMAIL = "eric.m.link@gmail.com"
```

Change that to your real address if needed. `NOTIFY_EMAIL` is not secret; keeping it under `[vars]` is fine.

### 4. Set Resend API key (secret, optional)

1. Create an API key in the Resend dashboard.
2. For production:

```bash
npx wrangler secret put RESEND_API_KEY
```

3. For local: put the same value in `.dev.vars` (see `.dev.vars.example`).

If the key is missing, the API still inserts the row; the Worker logs:

`[feedback-wall] RESEND_API_KEY not set — skipping email notification`

**From address:** the sample uses Resend’s onboarding sender `Feedback Wall <onboarding@resend.dev>`. For production, verify your domain in Resend and change the `from` field in `src/email.ts`.

### 5. Deploy

```bash
npm run deploy
```

Wrangler uploads Assets + the Worker. Your public URL looks like:

`https://feedback-wall.<your-subdomain>.workers.dev`

## API

### `GET /api/feedback`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Ada",
      "message": "Ship it.",
      "imageUrl": null,
      "createdAt": "2026-09-29T22:00:00.000Z"
    }
  ]
}
```

`imageUrl` is always `null` while R2 is disabled.

### `POST /api/feedback`

`multipart/form-data` fields:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | ≤ 80 chars |
| `message` | yes | ≤ 1000 chars |

Any `image` file field is ignored. Response `201`:

```json
{ "item": { "id": "…", "name": "…", "message": "…", "imageUrl": null, "createdAt": "…" } }
```

### `GET /img/:key`

Returns `404` (R2 image serving disabled).

## Schema (D1)

```sql
CREATE TABLE feedback (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  image_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Notes

- Same-origin UI + API — no CORS setup required.
- R2 / image uploads are intentionally omitted until R2 is available on the account.
- Do not commit `.dev.vars` or real API keys. `.gitignore` already excludes `.dev.vars` and `.wrangler/`.
- Replace the placeholder `database_id` before remote migrate/deploy; local `wrangler dev` still works with the placeholder + `db:migrate:local`.

## License

Sample code — use and remix freely.
