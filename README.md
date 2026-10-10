# Nem Mail

An AI-powered, Gmail-style mail app for mobile, with its own visual identity called **Aurora Noir**.

> 🚧 In active development. Phase 1 builds the frontend against a realistic mock backend. Phase 2 adds the real API.

## Highlights (planned)

- Gmail-level features: categories, swipe triage, multi-select, threads, compose, undo send, schedule send, labels, snooze, and search operators.
- On-device AI/ML: smart categories, a from-scratch spam and phishing classifier, thread summaries, smart replies, smart compose, a priority inbox, semantic search, and a tone check.
- A bold dark-first design with fluid gestures and motion.

## Tech stack

| Layer              | Tech                                      |
| ------------------ | ----------------------------------------- |
| Web + mobile       | SvelteKit 2, Svelte 5, TypeScript         |
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

## License

MIT © Onah Stephen
