# Frontend guide

How the Nem Mail app in `apps/mobile` is put together, and where to make a change. For setup and commands, see the [README](../README.md).

## One build, three targets

`apps/mobile` is a SvelteKit 3 app built with `adapter-static` as a single-page app (`ssr = false`, fallback `index.html`). The same `build/` folder is:

- the **web demo** on Vercel (config in `apps/mobile/vercel.json`),
- the **PWA**: manifest, icons, iOS launch images and the service worker in `src/service-worker/`,
- the **Capacitor** `webDir` for the `android/` and `ios/` projects.

## Layers

Each layer may import only from the layers below it.

| #   | Layer      | Folder                | Holds                                                                       |
| --- | ---------- | --------------------- | --------------------------------------------------------------------------- |
| 1   | Routes     | `src/routes/`         | Composition and URL state only                                              |
| 2   | Features   | `src/lib/features/*`  | Feature UI and logic. A feature never imports another feature               |
| 3   | Components | `src/lib/components/` | `ui/` design-system primitives, `layout/` app chrome. No data fetching      |
| 4   | Stores     | `src/lib/stores/`     | App state as Svelte 5 runes classes (`*.svelte.ts`). They call repositories |
| 5   | Data       | `src/lib/data/`       | Repositories: the only layer that knows where data comes from               |
| 6   | Shared     | `packages/shared`     | Zod schemas, types, contracts, seed generator, query parser, text utils     |

The AI layer (`src/lib/ai/`) sits beside the stores. Features reach it through `AIService`.

When two features need the same part, move it down into `components/` or `utils/` instead of importing across features.

## Routes

```
/                          redirects: onboarding when signed out, Inbox when signed in
/onboarding                carousel and "Try the demo"
/mail/(list)/[mailbox]     inbox, starred, snoozed, sent, drafts, scheduled, spam, trash…
/mail/(list)/label/[id]    a label's threads
/mail/thread/[threadId]    thread view (on wide screens it shows in a reading pane instead)
/search                    search with operators and filter chips
/settings/...              general, swipe, ai, account, labels, about
/dev/gallery               design-system gallery (development aid)
```

`(list)` is a route group: its layout is the scroll shell with the floating search bar, the drawer and the account sheet. The thread view is outside it. Route guards live in `lib/utils/guard.ts`. The root layout shows the splash until the session is restored, so guarded pages never flash.

## Data layer

- `data/repositories.ts` defines the interfaces: auth, mail, labels, contacts, drafts, settings and search.
- `data/provider.ts` creates them from `PUBLIC_DATA_SOURCE` (`mock` or `api`) and puts them in Svelte context.
- `data/mock/` is the Phase 1 backend: seeded mail in IndexedDB (`idb`), cursor pagination, the shared error envelope, and a simulator that delivers new mail, finishes undo-send delays, and wakes snoozed threads.
- `data/http/` is where the Phase 2 HTTP repositories go.

Every method returns domain types from `@nem/shared` and throws `AppError` with an `ApiErrorCode`. The mock adds 150–600 ms of latency. Add `?fail=0.1` to the URL to fail 10% of calls, which is handy for testing error states.

**The boundary is enforced.** ESLint (`no-restricted-imports` in `eslint.config.js`) rejects any import of `data/mock` or `data/http` from outside `src/lib/data`. Code above the data layer must go through `#lib/data/repositories` or `#lib/data/provider`.

## Stores

Stores are classes with runes state, created once in the root layout and shared through context (`get…Store()`):

| Store       | Job                                                                                |
| ----------- | ---------------------------------------------------------------------------------- |
| `session`   | Signed-in accounts, the current account, restore on reload                         |
| `mailbox`   | Cached thread lists per query, optimistic actions with Undo, counts, server events |
| `thread`    | The open thread and its messages                                                   |
| `selection` | Multi-select state                                                                 |
| `ui`        | Drawer, sheets and compose requests                                                |
| `toast`     | Snackbars, with an action and a duration                                           |
| `theme`     | Dark, light or system theme, synced to the status bar                              |

Writes are optimistic: the store updates the cached lists first, calls the repository, and rolls back with an error toast if the call fails.

## AI layer

- `ai/service.svelte.ts` (`AIService`) is the facade features call. It checks the Settings toggles, caches results, and falls back to rules when a model is off or still loading.
- Heavy work runs in `ai/worker/ai.worker.ts` through Comlink, so it never blocks scrolling or typing.
- `ai/models/` holds the classic models, written from scratch: Naive Bayes (spam, categories), logistic regression (priority), an n-gram model (smart compose), TextRank (summaries), and rules for smart replies, tone, nudges and extraction.
- `ai/registry.ts` lists the optional transformer models (MiniLM L6 v2, DistilBERT SST-2, MobileBERT MNLI, DistilBART CNN 6-6). They are Apache-2.0 and quantized ONNX, and they download only on opt-in. The About page credits them from the registry.
- Every result is `{ value, confidence, explanation, source: 'model' | 'heuristic' }`. The UI shows an AI badge that explains it.

To add an AI feature: write the model or the rules in `ai/models/` with tests, expose it on the worker API, add a method and a toggle on `AIService`, and show the result with `AIBadge`. Keep a non-AI fallback.

## Design system: Aurora Noir

- `styles/tokens.css` holds every color, space, radius, type and motion token, for dark (default) and light. Never hard-code a color in a component.
- `styles/global.css` holds resets, focus rings, safe areas, reduced-motion and low-power rules. `styles/ionic.css` maps Ionic variables to the tokens.
- `motion/` has the spring and transition presets. Under reduced motion every duration drops to zero.
- **Low-power mode** (`utils/low-power.ts`) sets `data-low-power` on `<html>` when the battery is low, Data Saver is on, or the device has little memory. That stills the aurora, the orb glow and shimmer, and turns off backdrop blur.
- Ionic is used only for platform primitives (`ion-menu`, `ion-refresher`, `ion-datetime`). Rows, sheets, buttons and chips are our own Svelte components, and routing stays with SvelteKit.
- `/dev/gallery` shows every primitive in both themes.

## Native and PWA

The helpers in `lib/utils/` wrap each Capacitor plugin and fall back to a web API in the browser:

| Helper             | Native plugin             | Web fallback                                |
| ------------------ | ------------------------- | ------------------------------------------- |
| `status-bar.ts`    | StatusBar                 | `theme-color` meta (set by the theme store) |
| `splash-screen.ts` | SplashScreen              | In-app splash                               |
| `haptics.ts`       | Haptics                   | `navigator.vibrate`                         |
| `keyboard.ts`      | Keyboard                  | `visualViewport` inset                      |
| `share.ts`         | Share                     | Web Share, then clipboard                   |
| `notifications.ts` | Local Notifications       | Notification API                            |
| `back-button.ts`   | App (Android back button) | The browser's own back                      |

The service worker (`utils/sw-cache.ts` picks the strategy) precaches the build and static files. Page loads get the cached shell when offline, precached files come from the cache, and other same-origin requests go network-first. Model downloads are left to Transformers.js, which caches them itself.

## Testing

| Kind               | Where                                                                              | Run                              |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| Unit and component | `*.test.ts` next to the code (Vitest, Testing Library, jsdom)                      | `npm run test`                   |
| End-to-end         | `apps/mobile/tests/e2e/` (Playwright, iPhone 14 in WebKit and Pixel 7 in Chromium) | `npm run test:e2e`               |
| Accessibility      | `tests/e2e/a11y.spec.ts` (axe, WCAG 2.2 AA, both themes)                           | part of e2e                      |
| Visual             | `tests/e2e/visual.spec.ts`, baselines in `visual.spec.ts-snapshots/`               | part of e2e                      |
| Model accuracy     | evaluation tests in `src/lib/ai/models`                                            | `npm run eval:ai -w apps/mobile` |

- e2e runs against the production build (`npm run build && vite preview`). Shared steps such as `openInbox` and `toast` are in `tests/e2e/helpers.ts`.
- The visual baselines were taken on Windows (`-win32` suffix). Update them with `npx playwright test visual --update-snapshots` from `apps/mobile`.
- CI (GitHub Actions) runs lint, check, unit tests and the build on every push. e2e runs locally.

## Conventions

- TypeScript strict. Imports use the `#lib`, `#components` and `#features` aliases and `@nem/shared`.
- Every screen handles loading, empty, error and success states (`Skeleton`, `EmptyState`, `ErrorState`).
- Every gesture has a tap alternative, every control has a label, and touch targets are at least 44 px.
- Pure logic goes in plain `.ts` files with unit tests; components stay thin.
