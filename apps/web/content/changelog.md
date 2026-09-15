---
title: Changelog
updated: 2026-09-15
---

## 2026-09-15 · Hunted Leads, in-app instructions, forgiving city names

- **Hunted Leads**: a new page with every lead ever found for your workspace, newest first, filterable by the search that found it.
- Every feature page starts with a short "how to use this" guide (dismissible, with a link to the manual).
- City names in any spelling (`newyork`, `NewYork`, `NYC`, `new york city`) are understood in the query and in the City field.
- Search runs now say when leads could not be saved, instead of showing an empty page.

## 2026-09-15 · Platform providers & keys in the OS-Panel

- Lead search: multi-word phrases are kept together ("gym accessories"), Instagram account search no longer receives the location text, Google queries target profile pages and turn post hits into their authors, and an empty result now explains what your filters excluded.

- New **OS-Panel → Providers & keys**: the Apify token, AI provider and key, embeddings and the Meta app are set once for the whole platform, with test buttons and a one-click recommended Actor set. Workspaces inherit these automatically; per-workspace overrides remain available on each organisation page.
- Faster, more resilient database connections.
- Cookie-backed light/dark preference (no flash on load) and a white-O favicon / app icon.

## 2026-09-15 · Neo template, mobile app experience, operations moved to OS-Panel

- New **Neo** template: futuristic glass, aurora backdrop, cyan / violet light, Orbitron headings, subtle motion.
- Installable mobile app: home-screen icon, standalone mode, bottom tab bar, native-sized controls, bottom-sheet dialogs, offline notice.
- Technical settings (provider keys, Actors, job limits, AI provider) are now managed exclusively by the CNEX AI team from the OS-Panel; workspaces see a simple *Services* readiness list.
- Workspace switcher removed from the sidebar (moved to Settings → Account for members of several workspaces).
- Product name is OSES-J everywhere; contact details updated (info@cnexai.com, +92 312 7233047, admin@cnexai.com).

## 2026-09-14 · Bauhaus Mix, public website, OS-Panel

- New **Bauhaus Mix** template (Bauhaus geometry + graffiti + mixed media + pop art) selectable in Settings → Appearance; applies to the whole workspace.
- Solid, sharp icon set and new typography (Manrope for Classic; Archivo Black, Space Grotesk and marker accents for Bauhaus Mix).
- Public website with features, how it works, this manual, changelog, about, contact and legal pages.
- **OS-Panel**: platform control room for the CNEX AI team (organisations, users, jobs, audit log, system).
- Workspace suspension with a clear notice for members.

## 2026-09-14 · Deployment hardening

- Git-based hosting support: Node 22, pnpm 9-11, `server.js` entry file, migrations without native binaries.
- Health endpoint reports configuration problems by name.

## 2026-09-13 · MVP

- Lead search with natural-language queries, Apify providers, normalisation, de-duplication and scoring.
- Enrichment from websites and profiles with sourced contacts.
- Saved leads, Add to Business with permanent CIDs, tags, notes, trash.
- Unified inbox, composer with AI variants, manual / extension / Apify / Meta delivery, scheduling.
- AI sales agent with company facts, instructions, knowledge base, rule validation and Manual / Copilot / Autopilot modes.
- Campaigns, documents, competitor and trend analysis, performance dashboard.
- Chrome extension for browser automation; Meta OAuth and webhooks.
