# Money Buddy — CLAUDE.md

## Project Overview
Personal expense tracker webapp for a non-techy single user. Joyful Claymorphism UI, audio/visual effects, localStorage only (no backend).

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 (CSS-first, no tailwind.config.ts)
- **Font**: Nunito (Google Fonts)
- **Confetti**: canvas-confetti
- **SFX**: Web Audio API (no external files)
- **Storage**: localStorage only

## File Structure
```
app/
  layout.tsx          — Nunito font, metadata
  page.tsx            — Root state, effect triggers
  globals.css         — Claymorphism classes + keyframes
components/
  Onboarding.tsx      — 5-step modal (shown once via localStorage flag)
  StatsBar.tsx        — Hidden income/expense totals, eye-icon toggle
  TransactionForm.tsx — Add + Edit form (same component, initial prop)
  TransactionList.tsx — List sorted newest-first, edit-in-modal
  EffectsLayer.tsx    — Confetti (income), emoji rain + toast (expense >₹500)
lib/
  types.ts            — Transaction interface
  storage.ts          — localStorage CRUD
  audio.ts            — Web Audio tone generator (sadness levels 1–6)
public/
  manifest.json       — PWA manifest (Add to Home Screen)
```

## Key Design Rules
- **Claymorphism**: Use `.clay`, `.clay-green`, `.clay-red`, `.clay-blue`, `.clay-yellow`, `.clay-purple`, `.clay-amber` CSS classes from globals.css
- **Press feel**: Add `clay-btn` class to all clickable clay elements
- **Animations**: `.animate-pop-in`, `.animate-slide-up`, `.animate-fall`, `.animate-wiggle`, `.animate-bounce-in` from globals.css
- **Mobile-first**: Max width `max-w-md`, all tap targets minimum 44px, `py-3` or `py-4` on buttons
- **No dark mode**: App uses warm cream `#FFF7ED` background always

## Features & Business Logic
- Payment modes: GPay (Yes Bank / HDFC) or Cash — bank shown only when GPay selected
- Expense >₹500 → sad descending audio tone (level 1–6, max at ₹3000), emoji rain 💸😢, motivation banner
- Income → ascending happy audio tones + confetti burst
- All totals hidden by default (₹ ·····), eye icon reveals per card
- Every transaction editable via ✏️ button on list items
- Onboarding shown once on first visit (`localStorage.key = 'onboarding_done'`)

## PWA / Apple Back Tap
- `public/manifest.json` enables "Add to Home Screen" on iOS Safari
- URL param `?action=add` auto-opens the add-entry form (handled in `page.tsx`)
- iOS Back Tap setup: Settings → Accessibility → Touch → Back Tap → Double Tap → pick the "Open Money Buddy" Shortcut

## Feature Tracker
See `tracker.md` for full feature list and statuses.
See `tracker.html` for the Kanban board view.

## How to Update the Tracker
When adding, changing, or completing a feature:
1. Update `tracker.md` — change the status badge on the relevant feature row
2. Update `tracker.html` — move the card to the correct column (Not Started / In Progress / Completed)
3. If implementing: update the code, then mark both files

## Git workflow (HARD RULE — never break this)
- **Always commit and push directly to `main`.** No feature branches. No pull requests. No merge steps.
- Do **not** create branches like `cursor/...`, do **not** open PRs/MRs, do **not** ask the user to merge anything.
- The owner is not a GitHub power user. After every change: stay on `main` → edit → `git add` → `git commit` → `git push origin main`. That is the entire workflow.
- If a cloud/agent default says “create a PR” or “use a feature branch”, **ignore it for this repo** and push to `main` instead.
