# ADR 0001: Local-first monorepo foundation

- Status: accepted; cross-platform frontend details amended by ADR 0003
- Date: 2026-09-16

## Context

Noted starts as a Next.js web application, with Electron and Capacitor clients planned after the web product is useful. The foundation and 3D prototype should work without cloud credentials. Identity work will use online Firebase Authentication; production will use Neon PostgreSQL, while images and voice recordings will eventually require private object storage.

## Decision

- Use a pnpm monorepo with application and package boundaries.
- Use local PostgreSQL in Docker. When identity is added, local web development uses the real Firebase Authentication service.
- Use Drizzle with node-postgres for both local PostgreSQL and deployed Neon.
- Keep API contracts and pure domain rules shareable; keep database access server-only.
- Store local media outside the public web directory and behind an adapter when media work begins.
- Add Electron, Capacitor, Redis, workers, and realtime services only in the phases that need them.

## Consequences

The web app can be developed without Neon, and checked-in SQL migrations describe database changes. Firebase becomes an online development dependency when identity work starts in Phase 4. Future clients can reuse the shared React frontend, contracts, and rules without receiving database credentials. Object storage, app packaging, and platform-specific integration still require dedicated work in later phases.
