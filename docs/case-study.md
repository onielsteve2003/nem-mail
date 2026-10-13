# Case study: Nem Mail, Phase 1 (frontend)

> Draft. A Gmail-class mail app for phones, built as a portfolio piece by Onah Stephen.
> Live demo: [nem-mail.vercel.app](https://nem-mail.vercel.app) · Code: [github.com/onielsteve2003/nem-mail](https://github.com/onielsteve2003/nem-mail)

<p>
  <img src="media/portfolio/inbox-dark-iphone.png" width="200" alt="Inbox in the dark theme on an iPhone" />
  <img src="media/portfolio/thread-dark-iphone.png" width="200" alt="A thread with AI quick actions and suggested replies" />
  <img src="media/portfolio/search-light-iphone.png" width="200" alt="Search results in the light theme" />
</p>

Walkthrough (35 s, Pixel 7 size):

<img src="media/walkthrough.gif" width="276" alt="Onboarding, inbox, a thread with a smart reply sent, the drawer, search and settings" />

## The brief

Rebuild the everyday mail app most people use, to a standard where a visitor opening the link for two minutes feels the polish: smooth gestures, fast lists, and AI that helps without getting in the way. Two hard rules:

- **Free only.** No paid APIs, no paid hosting, no AI service bills.
- **Phone first.** The owner tests on an iPhone from a Windows PC, so the web build has to feel native in Safari and as a home-screen app.

Phase 1 is the full frontend against a mock backend. Phase 2 adds a real API (Java 25 + Spring Boot 4) without changing the UI.

## What I built

- **Mail you can triage with your thumb.** Category tabs, swipe actions with a magnet and fling, long-press multi-select, Undo on everything destructive, snooze, labels, stars.
- **Threads and compose.** Collapsed older messages, sanitized HTML email, a bottom-sheet composer with recipient chips, autosaved drafts, undo send and scheduled send.
- **Search.** Gmail operators (`from:`, `has:attachment`, `before:` …), filter chips, highlighted matches and recent searches.
- **Eleven on-device AI features.** Categories, spam with an explanation, summaries, smart replies, ghost-text compose, priority inbox, semantic search, tone check, nudges, extraction chips and an assistant sheet.
- **Aurora Noir**, a design system of my own: tokens, dark and light themes, motion presets, reduced-motion and low-power modes.
- **One codebase, four targets.** Web demo, installable PWA with offline support, an Android app and an iOS project, through Capacitor.

## Key decisions

**A repository layer between the UI and the data.** Screens and stores talk only to repository interfaces. In Phase 1 those are backed by a seeded IndexedDB "mock server" with realistic latency and live arrivals; in Phase 2 an HTTP implementation slots in. A lint rule fails the build if UI code reaches past the boundary, so the swap stays a config change.

**AI on the device, small models first.** Every feature starts with a classic method that is tiny and instant (Naive Bayes written from scratch, TextRank, an n-gram model, logistic regression, rules). Transformer models (MobileBERT, DistilBART, MiniLM, DistilBERT) are optional downloads the user turns on in Settings. Everything runs in a Web Worker, so scrolling and typing never wait on inference, and no mail content leaves the phone. Each feature has a non-AI fallback, a toggle and an "AI" badge.

**Native feel on the web.** iPhone Safari is the main target, so the work went into details: 16 px fields so focus never zooms, safe areas, no rubber-band on the shell, standalone detection, a status bar that follows the theme, haptics where the platform has them, and a service worker that boots the app offline.

**Performance budget.** Compose, the assistant and the two-pane reader load on idle, the list virtualizes above 200 rows, and fonts are subset. First-route JavaScript for the inbox is 189 KB gzipped (budget 200). Lighthouse mobile on the live site: Performance 92, Accessibility 100, Best Practices 100.

## Quality

- **End to end:** 36 Playwright tests cover the seven core flows (onboarding, triage, read, reply, compose, search, navigate) on an iPhone 14 (WebKit) and a Pixel 7 (Chromium).
- **Visual regression:** 20 baselines of five key screens in both themes on both phones, made deterministic by freezing the clock and hiding AI output that arrives in any order.
- **Accessibility:** axe checks (WCAG 2.2 AA) of the main screens in both themes, focus traps on sheets, and a tap alternative for every gesture.
- **Native builds in CI:** GitHub Actions builds the Android APK and launches it on an emulator, and compiles the iOS project on a cloud Mac.
- **Manual pass** on a real iPhone (Safari and home-screen app), Android Chrome and desktop.

## Hard parts

- **Gestures that don't fight scrolling.** Swipe rows lock to an axis only after 10 px with a 1.5× ratio and capture the pointer only then, so vertical scrolling stays native and a swipe never fires a tap.
- **Deterministic screenshots of a living inbox.** The mock server generates mail relative to "now" and keeps sending new mail; visual tests pin the clock so the seed and the arrivals are frozen.
- **iOS without a Mac.** The iOS project is generated and checked on Windows, then compiled on a GitHub-hosted Mac; the day-to-day iPhone path is the PWA.

## What's next

Phase 2: a Java 25 + Spring Boot 4 API on Render with Postgres and pgvector on Neon, real auth, server-side search and embeddings, and the frontend switched from the mock to the API with no UI changes.
