# ADR 0003: Shared React frontend with platform shells

- Status: accepted
- Date: 2026-09-18

## Context

The Phase 2 fridge was implemented inside `apps/web`, but the intended Electron and Capacitor applications need the same React interface. Delaying extraction would let Next.js-specific imports, public paths, and global styles spread through later features. Creating the native applications now would add empty scaffolding before they have platform responsibilities.

## Decision

- Put the existing React fridge, Three.js scene, interaction rules, focused tests, and scoped styles in `packages/fridge-ui`.
- Keep App Router files, metadata, fonts, public assets, HTTP routes, and server-only code in `apps/web`.
- Let the Next.js shell render `fridge-ui` and pass the current photo/audio asset locations as serializable props.
- Keep `fridge-ui` based on React DOM and browser standards. It must not import Next.js, Electron, Capacitor, database code, or privileged server modules.
- Detect browser/WebGL availability inside the shared scene without requiring Next.js dynamic imports. The simple CSS fridge remains visible when WebGL is unavailable.
- Have future Electron and Capacitor shells compile the same package and supply concrete native capability adapters when camera, recording, authentication callbacks, or OS integration are implemented.
- Introduce `packages/api-client` with the first real identity/home HTTP operations in Phase 4. Do not create artificial backend traffic during the frontend-only extraction.

## Consequences

The current website keeps its Next.js structure and behavior while the reusable frontend has a platform-neutral owner. Future clients do not copy the fridge source. Each shell still requires its own build, permissions, authentication callback, packaging, and native integration work. Plain browser image elements are used inside the shared package because Next.js image components cannot run unchanged in Capacitor and Electron; the platform shell remains responsible for supplying valid asset URLs.
