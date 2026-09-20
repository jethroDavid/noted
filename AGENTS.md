# Noted project instructions

## Frontend architecture

Follow [the shared frontend architecture](docs/architecture/frontend.md) when adding or changing frontend features.

- Keep reusable components, state, and operations together under `packages/fridge-ui/src/features/<feature>`. Put common visual primitives in `src/ui`.
- Application shells own platform SDKs, authentication adapters, API configuration, and navigation. Shared features receive those capabilities through their provider.
- `HomesProvider` owns one controller. Components consume it through `useHomes()`; they must not create additional controllers to access the same feature state.
- Prefer named handlers and explicit `async/await` operations. Avoid generic wrappers that require callers to pass nested work and completion callbacks merely to save repeated lines.
- Keep tests close to the behavior they verify and update the architecture guide when ownership or public entry points change.

## Icons and brand artwork

Before adding or modifying interface icons, the Noted brand mark, the wordmark, or the favicon, read [the icon design guidelines](docs/design/icons.md) and inspect the referenced source files.

- Match the documented style for ordinary additions. Reuse an existing icon when it expresses the same action.
- When the user requests a new icon style, update the guidelines and the affected icon set together. Preserve meanings and accessible labels, and visually compare the results at their actual display sizes.
- Treat interface icons and brand artwork as separate families. An interface-icon redesign does not implicitly redesign the brand.
- Keep shared interface icons in `packages/fridge-ui`; keep platform assets in their application shell.

These instructions apply throughout the repository. The Next.js-managed instructions in `apps/web/AGENTS.md` also apply when working in that application.
