# Nem Mail

An AI-powered, Gmail-style mail app for phones, with its own visual identity called **Aurora Noir**. One SvelteKit codebase runs as a web demo, an installable PWA, and a Capacitor app for Android and iOS. The AI features run on the device.

**Live demo:** [nem-mail.vercel.app](https://nem-mail.vercel.app). Tap **Try the demo**; no sign-up is needed.

<p>
  <img src="docs/media/triage.gif" width="250" alt="Swiping a mail to archive it, undoing, then selecting two mails and archiving them" />
  <img src="docs/media/reply.gif" width="250" alt="Opening a thread, tapping a suggested reply and sending it" />
  <img src="docs/media/search.gif" width="250" alt="Typing a search and seeing suggestions and results" />
</p>

Full walkthrough video: [docs/media/walkthrough.webm](docs/media/walkthrough.webm) · Case study: [docs/case-study.md](docs/case-study.md)

> Phase 1 (this release) is the full frontend against a realistic mock backend in IndexedDB. Phase 2 adds a Java + Spring Boot API with no UI changes, thanks to the repository layer.

## Features

**Mail**

- Inbox categories (Primary, Promotions, Social, Updates, Forums) with category bundles and unread counts.
- Swipe to archive, delete, snooze or mark read (configurable), long press for multi-select with bulk actions, and Undo on every destructive action.
- Threads with collapsed older messages, safe HTML email (DOMPurify), attachments, and Gmail keys in a thread (`j` / `k` older and newer, `e` archive, `#` trash, `r` reply).
- Compose as a bottom sheet: chips for recipients with contact autocomplete, attachments, autosaved drafts, undo send, and schedule send.
- Labels (nested one level), snooze with a wake-up engine, stars, important, mute, and spam reporting.
- Search with Gmail operators (`from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `label:`, `before:`, `after:`), filter chips, highlights and recent searches.
- Two accounts on one device, a drawer for every mailbox and label, and a two-pane reading view on wide screens.

**On-device AI** (each one has a non-AI fallback, a Settings toggle and an "AI" badge)

| Feature                                      | How it works                                                 |
| -------------------------------------------- | ------------------------------------------------------------ |
| Smart categories                             | Naive Bayes plus rules; optional zero-shot MobileBERT MNLI   |
| Spam and phishing detection, with "why"      | Naive Bayes written from scratch; link and domain checks     |
| Thread summary and action items              | TextRank (extractive); optional DistilBART CNN               |
| Smart replies                                | Intent detection plus templates                              |
| Smart compose (ghost text)                   | N-gram language model trained on your sent mail              |
| Priority inbox                               | Logistic regression on sender and engagement features        |
| Semantic search                              | Optional MiniLM L6 v2 sentence embeddings, cosine similarity |
| Tone check before sending                    | Lexicon rules; optional DistilBERT SST-2                     |
| Follow-up nudges and unsubscribe suggestions | Rules over sent mail and open rates                          |
| Smart extraction                             | Codes, tracking numbers and dates as action chips            |
| AI assistant sheet                           | "Summarize unread", "What needs a reply?", "Draft reply"     |

Models run in a Web Worker, so scrolling and typing never wait for them. The optional transformer models are free, Apache-2.0, and downloaded only when you turn them on. In Phase 1 no mail content leaves the device.

**App feel**

- Aurora Noir design system: hand-made tokens, dark and light themes, fluid motion, reduced-motion and low-power modes.
- PWA with an offline service worker and iOS home-screen support (icons, splash screens, safe areas).
- Accessible: WCAG 2.2 AA checked with axe in both themes, keyboard support, focus traps, and a tap alternative for every gesture.

<p>
  <img src="docs/media/inbox-dark.png" width="190" alt="Inbox in the dark theme" />
  <img src="docs/media/thread-dark.png" width="190" alt="A thread in the dark theme" />
  <img src="docs/media/search-light.png" width="190" alt="Search results in the light theme" />
  <img src="docs/media/settings-light.png" width="190" alt="Settings in the light theme" />
</p>

## Architecture

```mermaid
flowchart TD
    R[Routes] --> F[Features and components]
    F --> S[Stores: Svelte 5 runes]
    S --> I[Repository interfaces]
    I --> M[Mock repositories<br/>IndexedDB + seed, Phase 1]
    I -.-> H[HTTP repositories<br/>Phase 2]
    H -.-> API[apps/api: Java 25 + Spring Boot 4<br/>PostgreSQL + pgvector]
    F --> A[AI service]
    A --> W[Web Worker<br/>classic ML + Transformers.js]
    SH[packages/shared<br/>Zod schemas, types, seed, query parser] --- I
    SH --- API
```

- **Repository pattern.** UI and stores only see interfaces in `data/repositories.ts`. `PUBLIC_DATA_SOURCE` picks the mock or the HTTP implementation. A lint rule blocks imports of a concrete backend outside `src/lib/data`.
- **Shared contracts.** Zod schemas in `packages/shared` define every request, response and error. The mock validates against them, and the Phase 2 API mirrors them.
- **Mock backend.** Seeded mail in IndexedDB with simulated latency, errors, new arrivals, send delays and snooze wake-ups.

More detail: [docs/frontend.md](docs/frontend.md).

## Tech stack

| Layer             | Tech                                                   |
| ----------------- | ------------------------------------------------------ |
| Web + mobile      | SvelteKit 3, Svelte 5 (runes), TypeScript strict       |
| Native shell      | Ionic core (`@ionic/core`) + Capacitor 8               |
| Styling           | Aurora Noir tokens, vanilla CSS                        |
| Data              | Zod contracts, IndexedDB (`idb`) mock backend          |
| ML                | Hand-written classic ML + Transformers.js, Comlink     |
| Tests             | Vitest + Testing Library, Playwright + axe             |
| Backend (Phase 2) | Java 25 + Spring Boot 4, PostgreSQL + pgvector, Flyway |
| Hosting           | Vercel (web), Render free tier (API, Phase 2)          |

## Repository layout

```
apps/mobile      SvelteKit SPA: web demo, PWA and Capacitor app (android/, ios/)
packages/shared  Zod schemas, types, seed generator, search query parser
docs/            Frontend guide, iOS guide, README media
```

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `npm run lint`     | Prettier check and ESLint                             |
| `npm run check`    | svelte-check (types)                                  |
| `npm run test`     | Unit and component tests (Vitest)                     |
| `npm run build`    | Static SPA build into `apps/mobile/build`             |
| `npm run test:e2e` | Playwright on iPhone 14 (WebKit) and Pixel 7 (Chrome) |

Settings live in `apps/mobile/.env` (copy `.env.example`). Every variable is public; the defaults run the mock backend.

## Viewing on an iPhone

1. Open [nem-mail.vercel.app](https://nem-mail.vercel.app) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Nem Mail from the home screen. It runs full screen with its own icon and splash, and works offline after the first visit.

A native iOS build needs a Mac with Xcode (or a cloud Mac). See [docs/ios.md](docs/ios.md).

## Running on Android

The native apps wrap the same static build (app ID `com.onahstephen.nemmail`). Install [Android Studio](https://developer.android.com/studio), which includes the JDK and Android SDK, then from `apps/mobile`:

```bash
npm run cap:sync     # build the SPA and copy it into the native projects
npm run cap:android  # open the Android project in Android Studio
```

Run it from Android Studio or with `npx cap run android`. On Android Chrome you can also use **Install app** from the browser menu.

No Android tooling? The [Android build](.github/workflows/android.yml) workflow builds a debug APK on every change to the native project and launches it on an emulator. Download `nem-mail-debug-apk` from the latest run on the Actions tab and install it on a phone (allow installs from unknown sources).

## License

MIT © Onah Stephen
