# Money Buddy — Feature Tracker

> Status: `✅ Completed` | `🔄 In Progress` | `⬜ Not Started`

---

## Core Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Next.js 16 + Tailwind v4 scaffold | ✅ Completed | App Router, TypeScript |
| 2 | localStorage data persistence | ✅ Completed | No backend needed |
| 3 | Transaction data model | ✅ Completed | id, type, amount, description, paymentMode, bank, date |
| 4 | Add Income entry | ✅ Completed | With amount, notes, payment mode, date |
| 5 | Add Expense entry | ✅ Completed | With amount, notes, payment mode, date |
| 6 | Edit any existing entry | ✅ Completed | Pre-filled form in bottom-sheet modal |
| 7 | Delete entry with undo | ✅ Completed | Immediate delete + 5s undo toast, no confirm dialog |
| 8 | Payment mode: GPay or Cash | ✅ Completed | Toggle in form |
| 9 | GPay bank selector: Yes Bank / HDFC | ✅ Completed | Shown only when GPay selected |
| 10 | Notes/description field (no categories) | ✅ Completed | Free-text, optional |

---

## UI / UX

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | Claymorphism design system | ✅ Completed | `.clay`, `.clay-green`, `.clay-red`, etc. in globals.css |
| 12 | Nunito rounded font | ✅ Completed | Google Fonts via next/font |
| 13 | Warm cream background (#FFF7ED) | ✅ Completed | Joyful, non-clinical feel |
| 14 | Mobile-first layout (max-w-md) | ✅ Completed | Primary device is phone |
| 15 | Clay button press animation | ✅ Completed | `.clay-btn` active state |
| 16 | Onboarding modal (5 steps, shown once) | ✅ Completed | localStorage flag `onboarding_done` |
| 17 | Hidden totals (₹ ·····) with eye icon | ✅ Completed | Per-card toggle, default hidden |
| 18 | Transaction list (newest first) | ✅ Completed | With payment badge, date, edit button |
| 19 | Empty state illustration | ✅ Completed | 🪙 icon + friendly message |
| 20 | Profile name + Hey [Name] greeting | ✅ Completed | localStorage, time-aware greeting |
| 21 | Desktop view optimization | ✅ Completed | 2-column layout on lg screens (lg:flex-row) |
| 22 | Quick amount shortcuts | ✅ Completed | ₹100 / ₹500 / ₹1000 / ₹2000 chips in form |
| 23 | Monthly summary view | ✅ Completed | Grouped by month with income/expense totals per group |
| 24 | Search & filter entries | ✅ Completed | Search by description, date, or amount |

---

## Audio / Visual Effects

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 25 | Income confetti burst | ✅ Completed | canvas-confetti, 3 staggered bursts |
| 26 | Income happy ascending tones | ✅ Completed | Web Audio API: C4→E4→G4→C5 |
| 27 | Expense sad descending tones (6 levels) | ✅ Completed | Level 1 (₹500) to Level 6 (₹3000+), slower + lower |
| 28 | Emoji rain 💸😢 for expense >₹500 | ✅ Completed | More emojis at higher amounts |
| 29 | Motivation banner toast (expense >₹500) | ✅ Completed | Random message, auto-dismisses in 10s |

---

## Data & Analytics

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 30 | Export to CSV | ✅ Completed | One-tap download, all transactions |
| 31 | Budget goal / spending limit | ✅ Completed | Set monthly limit, progress bar, over-budget alert |
| 32 | Spending insights chart | ✅ Completed | 4-month bar chart, income vs expense, CSS bars |

---

## PWA / Platform

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | PWA manifest.json | ✅ Completed | Enables "Add to Home Screen" on iOS Safari |
| 34 | ?action=add URL param | ✅ Completed | Auto-opens add form (for Back Tap shortcut) |
| 35 | iOS Back Tap shortcut support | ✅ Completed | User creates Shortcut → Back Tap. See CLAUDE.md |
| 36 | Offline support (service worker) | ⬜ Not Started | Could add next-pwa for full offline |
| 37 | Push notifications | ⬜ Not Started | Daily spending reminder (requires service worker) |

---

## Future Ideas

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 38 | Recurring transactions | ✅ Completed | Toggle in form, frequency picker, auto-adds on load, manage via RecurringManager |
| 39 | Multiple wallets / accounts | ✅ Completed | Wallet picker in form, WalletBar with net balances + opening balance, edit name/emoji/balance, add/delete custom wallets |
| 40 | Filter by wallet | ✅ Completed | Tap wallet card to filter transactions list, ✕ Clear filter button |
| 41 | Net balance / savings | ✅ Completed | Income − expense shown below stats cards, hidden by default with eye toggle |
| 44 | User login (username + password) | ✅ Completed | Sign up / sign in screen, per-user isolated data, session remembered on this device |
| 45 | Investment tracking | ✅ Completed | Third type alongside income/expense, own stats column, excluded from expense budget & net income |
| 46 | Custom types (was "categories") | ✅ Completed | Optional buckets in Settings, per-type budgets, filter view & tags on income/expense; Personal is preselected for new entries. Renamed to "Type" in feature 68 — spending categories are now a separate list |
| 47 | Savings goal | ✅ Completed | Target tracked via total investments, editable compact goal card |
| 48 | Due reminders | ✅ Completed | Upcoming recurring rules due within 7 days |
| 49 | Weekly summary | ✅ Completed | This week income, expense, investment, net |
| 50 | Wallet transfer | ✅ Completed | Move money directly between bank accounts, cash, and custom wallets; legacy category transfers migrate to wallets |
| 51 | Year-end report | ✅ Completed | Download CSV report with category & monthly breakdown |
| 52 | Low balance alert | ✅ Completed | Per-wallet min balance alert when editing wallet |
| 53 | Supabase cloud sync | ✅ Completed | Optional; username login syncs across devices when env vars set. See SUPABASE_SETUP.md |
| 54 | Category ↔ wallet linking | ✅ Completed | Optional category reference for budgeting and transaction tags; transfers use wallets directly |
| 55 | Can I afford this? check | ✅ Completed | Quick budget + wallet balance check before spending |
| 56 | Transfer history + undo | ✅ Completed | List wallet transfers; undo reverses both wallet entries |
| 67 | Dark app icon | ✅ Completed | Charcoal app icon with a simple wallet and rupee symbol for browser and home screen |
| 57 | Monthly close summary | ✅ Completed | Last month income/expense/by-category recap card |
| 58 | Personal / Business view mode | ✅ Completed | View toggle filters stats, list, charts |
| 59 | Business profit snapshot | ✅ Completed | Business income − expense this month |
| 60 | Daily welcome + streak | ✅ Completed | First visit each day greets you; streak badge in header |
| 61 | Split groups cloud sync | ✅ Completed | Split groups + credit card wallet fields now sync to Supabase (split_groups table, wallet CC columns) |
| 62 | Custom split shares | ✅ Completed | Equal (default) or Custom ₹ per person; last person auto-fills the remainder |
| 63 | Settled group net expense | ✅ Completed | Once a group is settled, stats count only my share (wallet history unchanged) |
| 64 | Settle-pending flow | ✅ Completed | Mark-settled asks per person: record payment or 🕊️ let it go |
| 65 | Remove member (settle first) | ✅ Completed | Must settle balance before removal; former members grayed out, kept on old entries |
| 66 | Split opening balances | ✅ Completed | Old pending balance per member (+100 = they owe me, -100 = I owe them); set on group create or via ✏️ next to names; counted in balances |
| 25 | Income confetti burst | ⬜ Removed | Replaced with calmer UX (no confetti/SFX) |
| 26 | Income happy ascending tones | ⬜ Removed | Audio effects removed |
| 27 | Expense sad descending tones | ⬜ Removed | Audio effects removed |
| 28 | Emoji rain for big expenses | ⬜ Removed | Negative celebration removed |
| 29 | Motivation banner toast | ⬜ Removed | Negative celebration removed |
| 43 | Dark mode | ✅ Completed | Light default with a saved manual switch; all app surfaces use a charcoal clay theme in dark mode |
| 68 | Spending categories, separate from Type | ✅ Completed | Food / Transport / Shopping etc. with their own monthly limit and chip on each expense. The old categories (Personal, Business, Savings) are now labelled "Type" since they drive the 👁️ View bar. Managed in Settings; own Supabase table |
| 69 | Voice entry (hold to talk) | ✅ Completed | Hold the 🎤 next to Add, or double-tap for hands-free. Groq Whisper transcribes English + Hindi, a Groq model fills the fields, and the normal form opens pre-filled to confirm. Several amounts in one sentence become stacked editable cards with one Save all |
| 70 | Voice questions | ✅ Completed | Ask "how much did I spend on food this month" and get the total, with the biggest entries and the category limit. Computed on the device, so no amounts are ever sent out |
| 71 | Full reset (Settings) | ✅ Completed | Danger-zone button with a confirm modal; wipes entries, transfers, recurring and splits on device + cloud. Wallets / types / spending categories stay |
| 72 | Auto spend-category from note | ✅ Completed | Typing "Zomato", "chai", "uber" etc. auto-selects Food / Transport / …; manual chip picks win |
| 73 | Dark dashboard home + expandable sheet | ✅ Completed | Pie split, monthly budget bar, month picker modal, ALL/EXPENSES/INCOME filters; sheet expands full-screen |
| 74 | Bottom dock: Home / Insights / Split / Tools / Settings | ✅ Completed | Green + FAB opens capture menu; 3rd tab is Split (±), not plus |
| 75 | Siri orb voice + image/PDF import | ✅ Completed | Hold or double-tap orb to talk; + menu for mic, photo, PDF statement → AI draft entries |
| 76 | AI Insights tab | ✅ Completed | Pacing / top-category cards with refresh; charts & wallets live here |
| 77 | Financial Tools tab | ✅ Completed | Subscriptions, EMIs, wallets, FD/RD + tax + EMI calculators, CSV export |
| 78 | Streak once-per-local-day | ✅ Completed | Uses local calendar date (not UTC); cloud merge keeps fresher visit; popup at most once/day |
| 79 | Premium Settings hub | ✅ Completed | AboutMoney-style account home: profile, categories, notifications, backup/export/share — no premium locks |
| 80 | Subscriptions + calendar | ✅ Completed | Orbital hub from Financial Tools; add via catalog/voice; filters (list/category/cycle); renewal calendar & notifications |
