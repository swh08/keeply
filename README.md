<p align="center">
  <a href="README.md"><strong>English</strong></a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/keeply-readme-lockup-dark.png">
    <img src="public/brand/keeply-readme-lockup-light.png" width="420" alt="Keeply">
  </picture>
</p>

<p align="center">
  <strong>A calm, self-hosted home for everything you own.</strong>
  <br>
  Organize possessions, costs, warranties, reminders, and usage history—online or offline.
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white">
  <img alt="Self-hosted" src="https://img.shields.io/badge/deployment-self--hosted-526E63?style=flat-square">
</p>

---

## Overview

Keeply is a local-first personal belongings archive. Changes are written to IndexedDB immediately, remain available offline, and synchronize with your own PostgreSQL instance when a connection returns.

## Highlights

- Track items, expenses, usage, warranties, reminders, and lifecycle events
- Keep currencies separate and exact—no hidden exchange-rate conversion
- Import and export JSON, CSV, XLSX, and versioned ZIP archives
- Install as a PWA with responsive desktop and mobile layouts
- Switch between English and Simplified Chinese, light and dark themes
- Self-host authentication and data with user isolation and safe migrations

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web | Next.js 16, React 19, TypeScript | UI, routing, API, PWA |
| Local data | Dexie, IndexedDB | Offline reads, immediate writes, sync queue |
| Authentication | Better Auth | Email/password login and sessions |
| Server data | PostgreSQL 17 | User-isolated records and sync cursor |
| Quality | Vitest, Playwright, axe-core | Unit, browser-flow, accessibility checks |

```text
Browser UI → IndexedDB → Sync queue ─┐
                                     ├→ Next.js API → PostgreSQL
Better Auth session ─────────────────┘
```

## Quick start

Requires Docker Engine and Docker Compose v2. This builds Keeply locally; it does **not** require Docker Hub or publish an image.

```bash
cp .env.example .env
```

Replace the placeholder values for `POSTGRES_ADMIN_PASSWORD`, `DATABASE_APP_PASSWORD`, and `BETTER_AUTH_SECRET` with three independent secrets. Generate each with `openssl rand -base64 32`.

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
curl --fail http://127.0.0.1:3000/api/health
```

Open [http://localhost:3000](http://localhost:3000).

## Local development

Requires Node.js 20.9+, pnpm 11, and PostgreSQL 15+.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Keep database and authentication secrets server-side; never expose them through `NEXT_PUBLIC_*` variables.

## Deployment

`compose.dev.yaml` builds a local image. Production `compose.yaml` expects `KEEPLY_IMAGE` and `KEEPLY_TAG` to reference an image you have explicitly published to your own registry—Keeply never pushes one automatically.

For production, place Keeply behind a TLS-enabled reverse proxy, keep PostgreSQL on the private container network, pin immutable image versions, and maintain verified database backups. See [.env.example](.env.example) for configuration.

## Quality

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## License

Private product code. Add the intended distribution license before publishing the repository.
