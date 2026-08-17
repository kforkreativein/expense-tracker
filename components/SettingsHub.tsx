'use client';
import { useEffect, useMemo, useState } from 'react';
import { getSession, updateDisplayName, logout } from '@/lib/auth';
import { getProfile, saveProfile, UserProfile } from '@/lib/profile';
import { getSpendCategories, addSpendCategory, deleteSpendCategory, restoreDefaultSpendCategories } from '@/lib/spendCategories';
import { clearSpendCategoryFromTransactions, getTransactions } from '@/lib/storage';
import { SpendCategory } from '@/lib/types';
import { fmt, isCurrentMonth } from '@/lib/insights';
import { sumRealExpense, getTransfers } from '@/lib/transfers';
import {
  enableNotifications,
  notificationsEnabled,
} from '@/lib/notifications';
import { getTheme, setTheme, Theme } from '@/lib/theme';
import { setCreditCardsEnabled, setSplitEnabled } from '@/lib/settings';
import { resetAllData } from '@/lib/reset';
import SettingsPanel from './SettingsPanel';

type Screen =
  | 'home'
  | 'profile'
  | 'categories'
  | 'notifications'
  | 'how'
  | 'whatsnew'
  | 'processing'
  | 'advanced'
  | 'legacy';

const CURRENCIES = [
  'INR Indian Rupee',
  'USD US Dollar',
  'EUR Euro',
  'GBP British Pound',
  'AED UAE Dirham',
  'SGD Singapore Dollar',
];

const AGE_OPTIONS = ['', ...Array.from({ length: 83 }, (_, i) => String(i + 13))];

const EMOJI_PICKS = ['🏷️', '🍔', '🛒', '🚗', '🏠', '💊', '🎬', '✈️', '👕', '📱', '🎓', '💡', '🎁', '☕', '💪', '🐕'];

interface Props {
  streak: number;
  onLogout: () => void;
  onChange: () => void;
  onReset?: () => void;
}

function Row({
  icon, label, onClick, danger, right,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[52px] active:bg-white/5"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-base shrink-0" aria-hidden>{icon}</span>
      <span className={`flex-1 text-[15px] font-semibold ${danger ? 'text-rose-400' : 'text-white'}`}>{label}</span>
      {right ?? <span className="text-zinc-500">›</span>}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-[#1c1c1e] border border-white/[0.06] divide-y divide-white/[0.06]">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2">{children}</p>
  );
}

function BackHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="mb-5">
      <button type="button" onClick={onBack} aria-label="Back" className="mb-3 text-white text-xl px-1 min-h-[44px]">‹</button>
      <h1 className="text-[28px] font-black text-white px-1">{title}</h1>
      {subtitle && <p className="mt-1 px-1 text-sm text-zinc-500 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 px-4 py-3.5">
      <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-[12px] border border-white/10 bg-black/35 px-3 py-3 text-[16px] font-semibold text-white outline-none placeholder:text-zinc-600 min-h-[48px]';

function firstName(full: string) {
  const part = full.trim().split(/\s+/)[0];
  return part || 'Friend';
}

export default function SettingsHub({ streak, onLogout, onChange, onReset }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setName] = useState('Friend');
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<UserProfile>(() => getProfile());
  const [spendCats, setSpendCats] = useState<SpendCategory[]>([]);
  const [notifOn, setNotifOn] = useState(false);
  const [theme, setThemeState] = useState<Theme>('dark');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState('');
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('🏷️');
  const [showCatForm, setShowCatForm] = useState(false);

  const spent = useMemo(() => {
    const tx = getTransactions().filter(t => isCurrentMonth(t.date));
    const tr = getTransfers().filter(t => isCurrentMonth(t.date));
    return {
      amount: sumRealExpense(tx, tr),
      count: tx.filter(t => t.type === 'expense').length,
    };
  }, [screen]);

  function reload() {
    const s = getSession();
    if (s) {
      setName(s.displayName || 'Friend');
      setUsername(s.username);
    }
    setProfile(getProfile());
    setSpendCats(getSpendCategories());
    setNotifOn(notificationsEnabled());
    setThemeState(getTheme());
    // Keep split + credit cards always available via Tools / wallets
    setSplitEnabled(true);
    setCreditCardsEnabled(true);
  }

  useEffect(() => { reload(); }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function exportCsv() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const txns = getTransactions().filter(t => {
      const [yy, mm] = t.date.slice(0, 10).split('-').map(Number);
      return yy === y && mm - 1 === m;
    });
    const headers = ['Date', 'Type', 'Amount', 'Description'];
    const rows = txns.map(t => [t.date, t.type, t.amount, `"${(t.description ?? '').replace(/"/g, '""')}"`]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `money-buddy-${y}-${String(m + 1).padStart(2, '0')}.csv`;
    a.click();
    flash(txns.length ? `Exported ${txns.length} rows` : 'No entries this month — empty CSV saved');
  }

  function backupData() {
    const blob = new Blob([JSON.stringify({
      exportedAt: Date.now(),
      transactions: getTransactions(),
      profile: getProfile(),
      spendCategories: getSpendCategories(),
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `money-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    flash('Backup saved');
  }

  async function restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (Array.isArray(data.transactions)) {
          const { userStorageKey } = await import('@/lib/auth');
          localStorage.setItem(userStorageKey('money_buddy_txns'), JSON.stringify(data.transactions));
        }
        if (data.profile) saveProfile(data.profile);
        if (Array.isArray(data.spendCategories)) {
          const { userStorageKey } = await import('@/lib/auth');
          localStorage.setItem(userStorageKey('money_buddy_spend_categories'), JSON.stringify(data.spendCategories));
        }
        flash('Backup restored');
        onChange();
        reload();
      } catch {
        flash('Could not read that backup file');
      }
    };
    input.click();
  }

  async function shareApp() {
    const text = 'Track expenses joyfully with Money Buddy';
    if (navigator.share) {
      try { await navigator.share({ title: 'Money Buddy', text, url: location.origin }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard?.writeText(`${text} ${location.origin}`);
      flash('Link copied');
    }
  }

  if (screen === 'legacy') {
    return (
      <div>
        <button type="button" onClick={() => setScreen('home')} className="mb-3 text-zinc-400 text-sm font-bold px-1">‹ Back</button>
        <SettingsPanel
          embedded
          onClose={() => setScreen('home')}
          onChange={() => { onChange(); reload(); }}
          onReset={onReset}
        />
      </div>
    );
  }

  if (screen === 'profile') {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader
          title="Edit Profile"
          subtitle="Update your details so insights and reminders fit you."
          onBack={() => setScreen('home')}
        />
        <Card>
          <Field label="Display name">
            <input
              value={name}
              onChange={e => {
                setName(e.target.value);
                updateDisplayName(e.target.value);
              }}
              placeholder="Your name"
              className={inputClass}
            />
          </Field>
          <Field label="Age">
            <select
              value={profile.age}
              onChange={e => setProfile(saveProfile({ age: e.target.value }))}
              className={inputClass}
            >
              {AGE_OPTIONS.map(a => (
                <option key={a || 'blank'} value={a}>{a || 'Select age'}</option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select
              value={profile.currency}
              onChange={e => setProfile(saveProfile({ currency: e.target.value }))}
              className={inputClass}
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Monthly income" hint="Used for pacing tips on Insights">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
              <input
                inputMode="numeric"
                value={profile.monthlyIncome}
                onChange={e => setProfile(saveProfile({ monthlyIncome: e.target.value.replace(/[^\d.]/g, '') }))}
                placeholder="e.g. 80000"
                className={`${inputClass} pl-8`}
              />
            </div>
          </Field>
        </Card>
        <SectionLabel>Account</SectionLabel>
        <Card>
          <Field label="Username" hint="Login ID — shown for reference">
            <input
              value={username ? `@${username}` : ''}
              readOnly
              className={`${inputClass} text-zinc-400`}
            />
          </Field>
          <Field label="UPI ID">
            <input
              value={profile.upiId}
              onChange={e => setProfile(saveProfile({ upiId: e.target.value.trim() }))}
              placeholder="yourname@okhdfcbank"
              className={inputClass}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Field>
        </Card>
      </div>
    );
  }

  if (screen === 'categories') {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader
          title="Edit Categories"
          subtitle="Rename, add with an emoji, or restore defaults."
          onBack={() => setScreen('home')}
        />
        <Card>
          {spendCats.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
              <span className="text-lg">{c.emoji}</span>
              <span className="flex-1 text-[15px] font-semibold text-white">{c.name}</span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => {
                  deleteSpendCategory(c.id);
                  clearSpendCategoryFromTransactions(c.id);
                  setSpendCats(getSpendCategories());
                  onChange();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white text-lg leading-none"
              >
                −
              </button>
            </div>
          ))}
        </Card>

        {!showCatForm ? (
          <button
            type="button"
            onClick={() => setShowCatForm(true)}
            className="text-center text-sm font-bold text-emerald-400 py-3 min-h-[44px]"
          >
            + Add category
          </button>
        ) : (
          <div className="rounded-[18px] border border-white/10 bg-[#1c1c1e] p-4 flex flex-col gap-3">
            <p className="text-sm font-bold text-white">New category</p>
            <input
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Category name"
              className={inputClass}
              autoFocus
            />
            <p className="text-xs font-bold text-zinc-500">Pick an emoji</p>
            <div className="flex flex-wrap gap-2">
              {EMOJI_PICKS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCatEmoji(e)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                    catEmoji === e ? 'bg-emerald-500/30 ring-2 ring-emerald-400' : 'bg-black/40'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCatForm(false); setCatName(''); setCatEmoji('🏷️'); }}
                className="flex-1 rounded-full bg-zinc-800 py-3 font-bold text-zinc-300 min-h-[48px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!catName.trim()) return;
                  addSpendCategory(catName.trim(), catEmoji);
                  setSpendCats(getSpendCategories());
                  setShowCatForm(false);
                  setCatName('');
                  setCatEmoji('🏷️');
                  onChange();
                }}
                className="flex-1 rounded-full bg-emerald-500 py-3 font-black text-white min-h-[48px]"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            restoreDefaultSpendCategories();
            setSpendCats(getSpendCategories());
            onChange();
            flash('Defaults restored');
          }}
          className="text-center text-sm font-semibold text-zinc-500 py-2"
        >
          Restore defaults
        </button>
      </div>
    );
  }

  if (screen === 'notifications') {
    const rows: { key: keyof UserProfile['reminders']; icon: string; title: string; sub: string }[] = [
      { key: 'daily', icon: '🕐', title: 'Daily Reminder', sub: 'Every day at 9:00 PM' },
      { key: 'weekly', icon: '📊', title: 'Weekly Summary', sub: 'Every Sunday at 10:00 AM' },
      { key: 'biMonthly', icon: '💡', title: 'Bi-Monthly Insights', sub: '1st & 15th at 11:00 AM' },
      { key: 'monthly', icon: '↻', title: 'Monthly Wrap-up', sub: '28th at 7:00 PM' },
      { key: 'subscription', icon: '🔔', title: 'Subscription renewals', sub: '1 day before each renewal' },
    ];
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader
          title="Notifications"
          subtitle="Pick the nudges you want from Money Buddy."
          onBack={() => setScreen('home')}
        />
        {!notifOn && (
          <button
            type="button"
            onClick={async () => {
              const ok = await enableNotifications();
              setNotifOn(ok);
              flash(ok ? 'Notifications enabled' : 'Permission denied');
            }}
            className="rounded-[16px] bg-rose-500/15 border border-rose-500/30 px-4 py-3.5 text-left"
          >
            <p className="font-bold text-rose-400">🔔 Notifications Disabled</p>
            <p className="text-sm text-rose-300/80 mt-0.5">Tap to enable notifications on this device.</p>
          </button>
        )}
        <SectionLabel>Reminders</SectionLabel>
        <Card>
          {rows.map(r => (
            <div key={r.key} className="flex items-center gap-3 px-4 py-3.5 min-h-[56px]">
              <span className="text-lg">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white">{r.title}</p>
                <p className="text-xs text-zinc-500">{r.sub}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile.reminders[r.key]}
                onClick={() => setProfile(saveProfile({ reminders: { ...profile.reminders, [r.key]: !profile.reminders[r.key] } }))}
                className={`relative h-7 w-12 rounded-full transition-colors ${profile.reminders[r.key] ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${profile.reminders[r.key] ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (screen === 'how') {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader title="How Money Buddy works" onBack={() => setScreen('home')} />
        <Card>
          {[
            ['➕', 'Log spends', 'Use + on the dock — voice, type for AI, photo, PDF, or manual form.'],
            ['📊', 'Home sheet', 'Pull the handle to expand transactions. Filter All / Expenses / Income / Transfers.'],
            ['✨', 'Insights', 'Wallets up top, then scrollable AI tips and charts.'],
            ['✂️', 'Split', 'Shared expenses with friends — always available from the dock.'],
            ['🛠', 'Tools', 'Budget, subscriptions, wallets, EMIs, and calculators.'],
          ].map(([icon, title, body]) => (
            <div key={title} className="flex gap-3 px-4 py-3.5">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="font-bold text-white">{title}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (screen === 'whatsnew') {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader title="What's new" onBack={() => setScreen('home')} />
        <Card>
          {[
            'Dark premium home with expandable transaction sheet',
            'Transfers filter on the home sheet',
            'Type-to-AI quick entry from the + menu',
            'Subscriptions hub in Financial Tools',
            'Safer recurring rules (no duplicate auto-adds)',
          ].map(item => (
            <div key={item} className="px-4 py-3.5 text-[15px] font-semibold text-zinc-200 flex gap-2">
              <span className="text-emerald-400">•</span>
              <span>{item}</span>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (screen === 'processing') {
    return (
      <div className="flex flex-col gap-4 pb-4">
        <BackHeader title="AI processing" onBack={() => setScreen('home')} />
        <Card>
          <div className="px-4 py-4 text-sm text-zinc-300 leading-relaxed space-y-3">
            <p>Voice, typed notes, receipt photos, and PDF statements are parsed securely to draft entries you confirm before saving.</p>
            <p>Nothing is saved as a final transaction until you approve the confirmation sheet.</p>
            <p className="text-zinc-500">Requires cloud login when AI features are enabled on the server.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {toast && (
        <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-800 px-4 py-2 text-xs font-bold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">Your account</p>
        <h1 className="mt-1 text-[32px] font-black text-white leading-tight">
          Hey, <span className="italic text-[#f5c542]">{firstName(name)}.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Make Money Buddy yours.</p>
        {streak > 0 && (
          <p className="mt-2 text-xs font-bold text-violet-300">🔥 {streak} day streak</p>
        )}
      </div>

      <div className="rounded-[18px] bg-[#1c1c1e] border border-white/[0.06] px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">Spent so far</p>
        <p className="mt-1 text-[28px] font-black text-white">{fmt(spent.amount)}</p>
        <p className="text-sm text-zinc-500">across {spent.count} transaction{spent.count === 1 ? '' : 's'} this month</p>
      </div>

      <div className="rounded-[18px] border border-[#f5c542]/35 bg-[#1a1510] px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f5c542]">Tip</p>
          <span className="text-[#f5c542]">✨</span>
        </div>
        <p className="mt-1 text-[17px] font-black text-[#f5c542]">Smarter money habits</p>
        <p className="mt-1 text-sm text-amber-100/70 leading-relaxed">
          Use Insights for pacing tips, Tools for subscriptions & wallets, and + for voice or typed AI entry.
        </p>
      </div>

      <div>
        <SectionLabel>Money</SectionLabel>
        <Card>
          <Row icon="👤" label="Edit Profile" onClick={() => setScreen('profile')} />
          <Row icon="🏷️" label="Edit Categories" onClick={() => setScreen('categories')} />
          <Row icon="🔔" label="Notifications" onClick={() => setScreen('notifications')} />
        </Card>
      </div>

      <div>
        <SectionLabel>Account</SectionLabel>
        <Card>
          <Row
            icon={theme === 'dark' ? '🌙' : '☀️'}
            label="Appearance"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              setTheme(next);
              setThemeState(next);
            }}
            right={<span className="text-xs text-zinc-400 capitalize">{theme} ›</span>}
          />
          <Row
            icon="✂️"
            label="Split groups"
            onClick={() => flash('Open the Split tab on the dock to manage groups')}
            right={<span className="text-xs text-zinc-500">Always on ›</span>}
          />
          <Row
            icon="💳"
            label="Credit cards & wallets"
            onClick={() => flash('Add or remove cards in Financial Tools → Wallets')}
            right={<span className="text-xs text-zinc-500">Via Tools ›</span>}
          />
        </Card>
      </div>

      <div>
        <SectionLabel>App</SectionLabel>
        <Card>
          <Row icon="▶️" label="How Money Buddy works" onClick={() => setScreen('how')} />
          <Row icon="⚡" label="What's new" onClick={() => setScreen('whatsnew')} />
          <Row icon="📊" label="Export this month (CSV)" onClick={exportCsv} />
          <Row icon="↻" label="Back up my data" onClick={backupData} />
          <Row icon="⬇️" label="Restore from a backup" onClick={restoreBackup} />
          <Row icon="⬆️" label="Share with friends" onClick={shareApp} />
          <Row icon="✨" label="AI processing" onClick={() => setScreen('processing')} />
          <Row icon="🛠️" label="Advanced settings" onClick={() => setScreen('legacy')} />
          <Row icon="🚪" label="Log out" onClick={() => { logout(); onLogout(); }} />
          <Row icon="⛔" label="Delete / reset data" danger onClick={() => setConfirmReset(true)} />
        </Card>
      </div>

      <p className="text-center text-xs text-zinc-600 pt-2">Money Buddy · v0.1.0</p>

      {confirmReset && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => !resetting && setConfirmReset(false)}>
          <div className="w-full max-w-sm rounded-[20px] bg-[#1c1c1e] p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white text-center">Reset everything?</h3>
            <p className="text-sm text-zinc-400 text-center">Entries, transfers, recurring and splits will be cleared. Wallets & categories stay.</p>
            <div className="flex gap-2 mt-1">
              <button type="button" disabled={resetting} onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-full bg-zinc-800 py-3.5 font-bold text-zinc-300 min-h-[48px]">Cancel</button>
              <button
                type="button"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  await resetAllData();
                  setResetting(false);
                  setConfirmReset(false);
                  onReset?.();
                  onChange();
                  flash('Data cleared');
                }}
                className="flex-1 rounded-full bg-rose-500 py-3.5 font-black text-white min-h-[48px]"
              >
                {resetting ? 'Resetting…' : 'Yes, reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
