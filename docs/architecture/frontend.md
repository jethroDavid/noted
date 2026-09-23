# Shared frontend architecture

Noted organizes its React frontend by feature. The Next.js application supplies platform capabilities to those features. Future Electron and Capacitor shells will supply their own adapters and compile the same frontend source.

## Folder map

```text
packages/fridge-ui/src/
  features/
    homes/
      components/
        home-route-view.tsx       Loading, error, home, and welcome states for one open home URL
        home-switcher.tsx
        home-switcher-view.tsx
        home-grid.tsx
        home-view.tsx
        home-welcome.tsx
        home-dialog.tsx
        create-home-dialog.tsx
        fridge-preview.tsx
        settings/
          home-settings-dialog.tsx
          home-members.tsx
          invite-member-form.tsx
          rename-home-form.tsx
      homes-provider.tsx
      homes-provider.test.ts
      homes-context.ts
      homes-auth.ts
      homes-keys.ts
      homes-keys.test.ts
      homes-query-client.ts
      use-homes.ts
      use-homes-controller.ts
      use-homes-controller.test.tsx
      index.ts
    fridge/
      components/
        fridge-app.tsx
        fridge-artwork.tsx     Shared image renderer and load-failure fallback
        fridge-plant.tsx       Decorative growth-stage images
        fridge-flat.tsx        Local SVG fallback
        post-card.tsx
        post-modal.tsx
        posts/
        modals/
      state/
        board.ts
        board.test.ts
        plant-growth.ts       Addition milestones and stage selection
        plant-growth.test.ts
        posts-keys.ts
        posts-keys.test.ts
        posts-query-client.ts
        posts-source.ts       FridgePostsSource rendered by FridgeApp
        fridge-posts-context.ts
        fridge-posts-provider.tsx
        use-fridge-posts.ts
        use-fridge-posts-controller.ts
        use-fridge-posts-controller.test.tsx
        use-fridge-posts-source.ts
        use-fridge-posts-source.test.ts
      index.ts
  ui/
    dialog-frame.tsx
    icons.tsx
    brand-link.tsx
  types.ts
  styles.css
  index.ts

apps/web/src/
  app/                         Next.js routes and HTTP endpoints
  platform/
    auth/                      Firebase setup and web authentication adapter
    api/                       API client configuration
  features/
    homes/                    Web shell: provider, route params, and Next.js navigation
    fridge/                   Playground shell and public asset paths
  app/app/homes/
    layout.tsx                One HomesProvider above the switcher and home routes
    page.tsx                  Switcher route
    [homeId]/page.tsx         Open-home route (deep-linkable, refreshable)
```

Tests live near the state or behavior they verify. Browser tests live in `tests/browser` because they exercise the assembled application.

## One owner for home state

`HomesProvider` creates one TanStack Query client per provider instance, held in component state, and renders a `QueryClientProvider` around an inner component that runs `useHomesController` once. The controller owns the account subscription, the profile and home queries, the named mutations, and the small client state (dismissed selection, operation error, sign-in status) that does not live in the cache. It has no Firebase, Next.js, Electron, or Capacitor imports.

`useHomes()` only reads the existing context value. Calling it from the switcher and a form shares the same state; it does not start another controller or another polling interval. Separate providers own separate caches, and server rendering does not create account subscriptions or fetch authenticated data. There is no global mutable home store and no module-level query client.

Selection belongs to the host shell: the web shell reads the home id from the `/app/homes/[homeId]` route and passes it into the provider, with `onOpenHome`/`onBackToHomes` callbacks for navigation. Opening a home navigates there and the home query loads it by id; leaving a route bumps the operation generation exactly like `backToHomes`, so late results and stale errors cannot leak across views. `HomeRouteView` resolves the route content (loading, error with retry, home, or the welcome fallback) while `HomeSwitcherView` stays the switcher-only view.

## One owner for fridge posts

`FridgePostsProvider` mirrors that shape for one open board: one TanStack Query client per provider instance, one `useFridgePostsController` run, and account-scoped keys under the `fridge-posts` prefix. It lives inside `HomesProvider` so an access-lost view can offer the homes navigation, and it receives the same stable `api` and `auth` instances through props threaded from the shell (`WebHomesShell` → `WebOpenHome` → `HomeRouteView` → `HomeView`).

The controller owns the board query (5s poll, focus/reconnect refetch, no auto-retry), the named post mutations, the server-time offset for removal countdowns, and the access-lost flag. Mutations write their exact response into the board cache entry; only creates bump the additions count locally, and polls correct any drift. `useFridgePostsSource()` adapts the controller to the `FridgePostsSource` that `FridgeApp` renders: server order becomes client layer order, and the server removal request time becomes `removedAt` for the existing grey/Undo display.

`FridgeApp` stays injectable: without a `source` it runs the local playground fixtures; with one it renders server posts, previews drags locally and commits on release, keeps modal drafts across polls, and shows a loading view, an error view with retry, and modal action errors. Selection stays local in both modes. The connected composer offers text notes only; photo and voice creation arrive with media support.

Feature components read their required state and operations through `useHomes()`. Pure display components, such as the grid and member list, still receive small explicit props. Draft inputs, dialog visibility, and success-message text belong to their local components.

## Follow one rename

1. `components/settings/rename-home-form.tsx` reads `home`, `busy`, and `renameHome` through `useHomes()`. It owns the name draft.
2. Its named `handleSubmit` calls `renameHome(home.id, draft.trim())`.
3. `use-homes-controller.ts` starts the operation and directly awaits its rename mutation, which calls `api.renameHome(homeId, name)`.
4. `packages/api-client` obtains a token from the configured token function, sends the HTTP request, and validates its response. This is the request service; no duplicate service wrapper is needed.
5. If the operation still belongs to this view, the controller writes the returned home into the home cache entry and merges it into the profile's home list. Creating a home additionally asks the shell to navigate to the new id; other operations keep the current route.
6. Context consumers render with the new state: the open fridge and the switcher list update together.
7. The operation returns `true`; the form displays its success message. Failures populate the controller error and return `false`, preserving the draft. Outdated results also return `false` and cannot display a successful save in a different view.

Operations use explicit `async/await` steps. Small helpers start operations, verify a settled result still belongs to the view, and report failures; they do not receive work or completion callbacks. Some repeated operation handling is intentional so each operation can be read from top to bottom.

## Server state and cache rules

TanStack Query owns all server state in the homes feature: the profile, the open home, background polling, and request cancellation. Client state stays in `useState`: the dismissed home id, the operation error, and the sign-in status. The selected home id arrives from the host shell instead of living in state. Derived values (`mode`, `busy`, `error`, `me`, `home`) are computed during render from query, mutation, and client state.

- Query keys carry the account (`homes-keys.ts`). Never read or write another account's entries. Account changes and sign-out remove the whole `["homes"]` prefix so the next account never flashes the previous one's data.
- Mutations write their exact response into the cache with `setQueryData`; they never refetch to confirm a write. Freshly written data counts as fresh for 15 seconds so enabling the home query never clobbers it. Polling and focus refetches provide eventual consistency with other devices.
- Query functions ignore the abort signal: leaving a view must not cancel its in-flight request. Late responses land in the cache and are ignored unless their view is still selected. Mutations are short user-initiated writes and are never cancelled; late results are dropped by stamp instead.
- Queries never auto-retry. Initial failures land in `error` mode with a manual `retry()`; background failures with cached data show the refresh banner.

## Platform boundary

The web shell creates a stable API client and a stable `HomesAuth` adapter and supplies them once to `HomesProvider`, along with the selected home id from the route. The optional `onSignedOut`, `onOpenHome`, and `onBackToHomes` callbacks let the shell choose navigation after sign-out, selection, and leaving a home.

The authentication adapter provides configuration status, the current account ID, account subscriptions, sign-in/out methods, and user-facing error translation. It must publish account changes through its subscription, provide an initial account notification, and return a function that removes the subscription. Sign-in may finish without an account-change event when reauthenticating the same account; the shared controller handles that case. Keep adapter instances stable for the provider's lifetime.

Firebase token access stays in `apps/web/src/platform/api/home-api.ts`. The shared API client accepts a `baseUrl` and token callback, so other shells can target the deployed backend. None of the shared code receives database credentials or privileged Firebase credentials.

Polling uses TanStack's interval plus its visibility-change and reconnect refetching, with a small window-focus bridge in the controller (TanStack does not listen for focus events itself), which keeps the shared feature platform-neutral. Native application resume events may require additional integration when Capacitor and Electron are implemented. Native authentication and packaging remain future work; moving the code does not claim device verification.

## Adding a feature

- Put feature-specific components, state, and behavior together in `features/<name>`.
- Add subfolders when they group a real set of related files, such as home settings or fridge posts/modals.
- Move a component into `ui` when multiple features use it. Keep feature-specific components in their feature.
- Expose intended entry points through the feature's `index.ts` and the package root. Application shells import the package, not another application's source files.
- Keep named event handlers and explicit operations easy to trace. A function without React hooks does not need a `use` prefix.
- Supply platform dependencies at the shell boundary. Lint rejects platform and backend imports in shared frontend source.
- Scope new query keys by account, write mutation responses into the cache, and clear the feature prefix on account changes. Never add per-request revision guards around queries; TanStack owns cancellation and staleness.

## Fridge artwork

The web shell supplies `kitchenBackdrop`, `fridgeArtwork`, and optional `plantArtwork` URLs through `FridgeAssets`. The shared feature uses ordinary image elements, keeping it independent of Next.js image components. The background, bare fridge, and plant are separate assets; notes remain accessible HTML on the unchanged logical board. `FridgeArtwork` owns only image-load failure state and falls back to the local SVG. New platform shells can package the same artwork and supply their own URLs.

`FridgeApp` owns the playground preview's addition count, incremented only when saving a new post. `plant-growth.ts` maps that activity to a stage; `FridgePlant` receives the stage and renders decorative images. Editing, moving, removal, expiry, and Undo do not change growth. Fixture posts do not count as user activity. This is preview state and resets on refresh, like the posts themselves. Shared homes instead read `postAdditions` from the board response: the server increments it in the create-post transaction, so growth reflects successful additions per home and is never inferred from the number of remaining posts.
