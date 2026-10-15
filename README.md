# LeadFlow

A lightweight, single-screen CRM for a sales rep: track leads, log every conversation, and never miss a follow-up.

![LeadFlow lead list with overdue and today's follow-ups pinned to the top](docs/screenshots/01-lead-list.png)

**Stack:** Next.js 16 (React 19, TypeScript, Tailwind CSS 4, TanStack Query) · FastAPI (SQLAlchemy 2, Pydantic 2, Alembic) · PostgreSQL 17 (Docker) or SQLite (local) · Playwright, Vitest, pytest · Docker Compose · GitHub Actions

## Features

- **Lead list** with name, company, status badge, last discussion note and time since that discussion.
- **Follow-ups pinned to the top:** overdue follow-ups (from earlier days) in red, then **today's follow-ups** in time order (times that have already passed turn red), then all other leads, most recently discussed first.
- **Filter by status** (New · Contacted · Qualified · Proposal Sent · Won · Lost) and **search** by name or company.
- **Timeline dialog** (a dialog, not a page): the full discussion history newest first, with status changes and cleared follow-ups recorded as system events.
- **Log a discussion** with an optional follow-up date and time. The lead's follow-up and the list update immediately; a lead with a follow-up today jumps into the pinned section.
- **Change status** from the dialog (persisted and logged), and **mark a follow-up done**.
- **Add new lead:** name required, company and phone optional, status starts as New.
- Unsaved notes survive closing the dialog, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> saves a note, and the phone number is a `tel:` link.
- Accessible: passes automated axe WCAG 2.2 AA checks, works fully from the keyboard, and uses a native `<dialog>`. Responsive down to 320 px; end-to-end tested in Chromium, Firefox and WebKit (Safari's engine), on desktop and phone viewports.

## Demo

▶️ **Walkthrough video (30 s):** [`docs/demo.webm`](docs/demo.webm), recorded by `npm run demo:record`.

| Timeline dialog | Add a lead |
| --- | --- |
| ![Timeline dialog with notes, a follow-up banner and the note form](docs/screenshots/03-timeline.png) | ![Add new lead dialog](docs/screenshots/04-add-lead.png) |

| Search | Phone | Phone: timeline |
| --- | --- | --- |
| ![Search results for "glob"](docs/screenshots/02-search.png) | ![Lead list on a phone](docs/screenshots/05-mobile-list.png) | ![Timeline dialog on a phone](docs/screenshots/06-mobile-timeline.png) |

## Quick start (Docker)

Requires Docker with Compose v2.

```bash
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
docker compose up --build
```

Open <http://localhost:3000>. Interactive API docs are at <http://localhost:3000/api/docs>.

The first start runs the database migrations and loads 9 demo leads. Demo follow-ups are placed relative to the server clock, so set `TZ` in `.env` to your timezone (for example `TZ=Asia/Kolkata`) to line "today" up with your browser. Stop with `docker compose down`, or add `--volumes` to also delete the data.

## Local development

Requires **Python 3.12+** with [uv](https://docs.astral.sh/uv/), and **Node.js 20.9+** (22 recommended). No database server is needed: the backend defaults to a SQLite file.

```bash
# Terminal 1 — API on http://localhost:8000
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.seed            # demo data; --reset wipes and reloads it
uv run uvicorn app.main:app --reload
```

```bash
# Terminal 2 — web app on http://localhost:3000
cd frontend
npm ci
npm run dev
```

The browser only talks to Next.js. Requests to `/api/*` are proxied to FastAPI (`BACKEND_URL`), so there is no CORS to configure.

## Configuration

All variables are listed in [`.env.example`](.env.example). Only the `POSTGRES_*` values are required, and only for Docker.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose | — | PostgreSQL credentials (database is not exposed outside Compose) |
| `SEED_DEMO_DATA` | Compose | `true` | Load demo leads on start when the database is empty |
| `TZ` | Compose | `UTC` | Server timezone used to place demo follow-ups on "today" |
| `WEB_PORT` | Compose | `3000` | Host port for the web app |
| `DATABASE_URL` | API | `sqlite:///./leadflow.db` | SQLAlchemy URL (Compose points it at PostgreSQL) |
| `LOG_LEVEL` | API | `INFO` | Python log level |
| `BACKEND_URL` | Web | `http://localhost:8000` | Where `/api/*` is proxied (resolved at build time) |

## Testing

| Suite | Command | What it covers |
| --- | --- | --- |
| API (55 tests) | `cd backend && uv run pytest` | Every endpoint and status code, validation, ordering, search escaping, timezone handling, migrations vs. models, DB constraints, seed data |
| API on PostgreSQL | `TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/db uv run pytest` | Same suite against a real PostgreSQL (tables are dropped and recreated) |
| Web unit (48 tests) | `cd frontend && npm test` | Relative times, local-day boundaries (pinned to UTC+5:30), follow-up grouping, validation, API error handling |
| End-to-end (14 flows × 5 browsers) | `npx playwright install` once, then `npm run test:e2e` | Real user journeys on Chromium, Firefox, WebKit, mobile Chrome and mobile Safari, plus axe WCAG 2.2 AA scans. Starts its own API and database on ports 8010/3010 and never touches your data |
| Static checks | `uv run ruff check . && uv run ruff format --check . && uv run mypy app tests alembic`<br>`npm run lint && npm run typecheck && npm run format:check` | Lint, strict typing, formatting |
| Demo media | `npm run demo:record` | Re-records `docs/demo.webm` and the README screenshots |

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the static checks and every test suite above (the API suite on both SQLite and PostgreSQL), plus a Docker Compose smoke test, on every push and pull request.

## API

Base path `/api`. JSON in and out. Timestamps are ISO 8601. Inputs must include a timezone offset; responses are in UTC (`Z`). Errors use FastAPI's shape: `{"detail": "Lead not found"}`, or a list of field issues for `422`.

| Method & path | Description | Success | Errors |
| --- | --- | --- | --- |
| `GET /leads?status=&q=` | List leads, most recently discussed first. `status` filters, and `q` matches name or company (case-insensitive) | `200` | `422` invalid filter |
| `POST /leads` | Create a lead `{name, company?, phone?}`; status starts as `new` | `201` + `Location` | `422` |
| `GET /leads/{id}` | Lead with its full timeline (`discussions`, newest first) | `200` | `404` |
| `PATCH /leads/{id}` | `{status?, follow_up_at?}`; `"follow_up_at": null` clears the follow-up | `200` | `404`, `422` |
| `POST /leads/{id}/discussions` | Log a note `{body, follow_up_at?}`; a follow-up also becomes the lead's follow-up | `201` | `404`, `422` |
| `GET /health` | Liveness, including a database round trip | `200` | `503` |

Writes return the full updated lead, so the client refreshes the list row and the open timeline from a single response.

```bash
curl -X POST localhost:3000/api/leads/1/discussions -H "Content-Type: application/json" \
  -d '{"body": "Sent the contract.", "follow_up_at": "2030-05-06T14:00:00+05:30"}'
```

## How it works

```mermaid
flowchart LR
  B[Browser] -- "page + /api/*" --> N["Next.js 16<br/>App Router · React 19"]
  N -- "proxy /api/*" --> F["FastAPI<br/>SQLAlchemy 2 · Pydantic 2"]
  F --> D[("PostgreSQL 17<br/>or SQLite")]
```

**Data model:** a `Lead` (name, company, phone, status, next follow-up) has many `Discussion` rows. Each row is a rep's `note` (optionally carrying the follow-up that was set) or a system `event` ("Lead created", "Status changed from Qualified to Proposal Sent", "Follow-up cleared"). The list's *last note* and its time come from a correlated subquery, so listing leads stays a single SQL query. Statuses are stored as strings with a database `CHECK` constraint. Schema changes go through Alembic, and a test verifies the migrations match the models.

**Decisions and assumptions**

- **"Today" is the viewer's today.** The API stores UTC. The browser groups leads by its local calendar day and re-checks every 30 seconds, so a follow-up turns overdue (red) as its time passes without a reload.
- **Overdue is pinned too.** A follow-up missed yesterday still needs action today, so overdue follow-ups get their own section above today's.
- **Follow-up semantics.** Logging a note *with* a follow-up replaces the lead's follow-up. A note *without* one leaves it untouched, and **Mark done** clears it. Follow-ups must be in the future.
- **Instant, consistent updates.** Mutations return the updated lead, which is written into every cached list and the open dialog straight away; the list is then refetched in the background so sorting and filters stay correct.
- **Login was optional in the brief and is intentionally not included.** LeadFlow is a single-rep tool: run it on a private network or behind an authenticating reverse proxy (see below).

## Production notes

- **Containers:** both images run as non-root users and have health checks. The API runs `alembic upgrade head` before starting; with several API replicas, run migrations as a separate release step instead. Only the web app's port is published.
- **Security:** same-origin API via the Next.js proxy (no CORS), security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), no `X-Powered-By`, validated input at the API boundary, parameterised SQL, and generic `500` responses (details only in server logs). Secrets come from the environment and are never committed.
- **Before exposing it publicly:** put it behind TLS and an auth layer (for example an SSO proxy) with request-size and rate limits. The app has no user accounts.
- **Operations:** logs go to stdout. `/api/health` checks the database. Back up PostgreSQL with `docker compose exec db pg_dump -U leadflow leadflow > backup.sql` (use your `POSTGRES_USER` and `POSTGRES_DB`).

## Known limitations

- No authentication or multi-user ownership (out of scope per the brief).
- The lead list isn't paginated. That's fine for one rep's book of a few thousand leads; it's marked as a `shortcut:` in `backend/app/service.py`.
- Leads and notes can't be edited or deleted from the UI.
- Unsaved note drafts are kept in memory, so a page reload clears them.

## Project structure

```text
backend/
  app/          FastAPI app: models, schemas, service layer, routes, seed script
  alembic/      Database migrations
  tests/        pytest suite (runs on SQLite or PostgreSQL)
frontend/
  src/app/                 Next.js App Router entry (layout, page, providers)
  src/components/ui/       Design-system primitives: button, dialog, field, feedback states
  src/components/leads/    Lead board, cards, filters, timeline dialog, note form, add-lead dialog
  src/lib/                 API client, React Query hooks, time and validation helpers (+ unit tests)
  e2e/                     Playwright end-to-end, accessibility and demo-recording specs
docs/           Screenshots and the demo video
docker-compose.yml, .env.example, .github/workflows/ci.yml
```
