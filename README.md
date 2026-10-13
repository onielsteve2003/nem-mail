# Nem Mail

An AI-powered, Gmail-style mail app for mobile, with its own visual identity called **Aurora Noir**.

**Live demo:** [nem-mail.vercel.app](https://nem-mail.vercel.app). Open it in Safari on an iPhone, tap Share, then **Add to Home Screen** for a full-screen app.

> 🚧 In active development. Phase 1 builds the frontend against a realistic mock backend. Phase 2 adds the real API.

## Highlights (planned)

- Gmail-level features: categories, swipe triage, multi-select, threads, compose, undo send, schedule send, labels, snooze, and search operators.
- On-device AI/ML: smart categories, a from-scratch spam and phishing classifier, thread summaries, smart replies, smart compose, a priority inbox, semantic search, and a tone check.
- A bold dark-first design with fluid gestures and motion.

## Tech stack

| Layer              | Tech                                      |
| ------------------ | ----------------------------------------- |
| Web + mobile       | SvelteKit 3, Svelte 5, TypeScript         |
| Native shell       | Ionic (`@ionic/core`) + Capacitor         |
| Backend (Phase 2)  | SvelteKit server endpoints                |
| Database (Phase 2) | PostgreSQL + Drizzle ORM                  |
| ML                 | Transformers.js + hand-written classic ML |

## Repository layout

```
apps/mobile      SvelteKit SPA: web demo, PWA and Capacitor app
apps/api         SvelteKit API (Phase 2)
packages/shared  Shared types, schemas and utilities
```

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev
```

## Running on a phone

The native apps wrap the same static build with Capacitor (app ID `com.onahstephen.nemmail`). Run these from `apps/mobile`:

```bash
npm run cap:sync     # build the SPA and copy it into the native projects
npm run cap:android  # open the Android project in Android Studio
```

**Android** works on Windows, macOS and Linux. Install [Android Studio](https://developer.android.com/studio), which includes the JDK and Android SDK. Then run the app from Android Studio or with `npx cap run android`.

**iOS** needs a Mac with Xcode. The `ios/` project is in the repo; on a Mac, from `apps/mobile`, run `npm run cap:sync` then `npx cap open ios`. A free Apple ID can sideload the app onto an iPhone for 7 days. Without a Mac, open the [web demo](https://nem-mail.vercel.app) in Safari, tap Share, then **Add to Home Screen**. Full steps and cloud Mac options: [docs/ios.md](docs/ios.md).

## License

MIT © Onah Stephen
