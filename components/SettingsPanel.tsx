'use client';
import { useState, useEffect } from 'react';
import { Category } from '@/lib/types';
import { getCategories, addCategory, updateCategory, deleteCategory } from '@/lib/categories';
import { clearCategoryFromTransactions } from '@/lib/storage';
import EmojiPicker from './EmojiPicker';
import {
  canUseNotifications,
  enableNotifications,
  notificationsEnabled,
  setNotificationsEnabled,
} from '@/lib/notifications';
import { getCreditCardsEnabled, setCreditCardsEnabled, getSplitEnabled, setSplitEnabled } from '@/lib/settings';
import { getTheme, setTheme, Theme } from '@/lib/theme';
import { getWallets } from '@/lib/wallets';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

interface Props {
  onClose: () => void;
  onChange: () => void;
}

export default function SettingsPanel({ onClose, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🏷️');
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [notifOn, setNotifOn] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [ccOn, setCcOn] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [wallets, setWallets] = useState<import('@/lib/types').Wallet[]>([]);

  function reload() {
    const cats = getCategories();
    setCategories(cats);
    setWallets(getWallets());
    setBudgetDrafts(Object.fromEntries(
      cats.map(c => [c.id, c.budget > 0 ? String(c.budget) : ''])
    ));
  }

  useEffect(() => {
    reload();
    setNotifOn(notificationsEnabled());
    setCcOn(getCreditCardsEnabled());
    setSplitOn(getSplitEnabled());
    setThemeState(getTheme());
  }, []);

  async function toggleNotifications() {
    if (!canUseNotifications()) {
      setNotifMsg('Notifications not supported in this browser.');
      return;
    }
    if (notifOn) {
      setNotificationsEnabled(false);
      setNotifOn(false);
      setNotifMsg('Daily reminders turned off.');
      return;
    }
    const ok = await enableNotifications();
    setNotifOn(ok);
    setNotifMsg(ok ? 'You\'ll get a welcome ping each new day.' : 'Permission denied — enable in browser settings.');
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addCategory(name, newEmoji);
    setNewName('');
    setNewEmoji('🏷️');
    reload();
    onChange();
  }

  function handleDelete(id: string) {
    deleteCategory(id);
    clearCategoryFromTransactions(id);
    reload();
    onChange();
  }

  function saveBudget(id: string) {
    const val = Number(budgetDrafts[id] || 0);
    updateCategory(id, { budget: val > 0 ? val : 0 });
    reload();
    onChange();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        className="clay animate-slide-up w-full max-w-sm max-h-[90dvh] overflow-y-auto flex flex-col gap-4 p-5 rounded-t-[24px] sm:rounded-[24px]"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-stone-800">⚙️ Settings</h2>
          <button type="button" onClick={onClose} className="clay-btn w-10 h-10 rounded-[12px] text-stone-500 font-black">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="clay p-3 flex flex-col gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Appearance</p>
            <p className="text-xs font-semibold text-stone-500 leading-relaxed">
              Choose the look that feels best for you. Your choice stays saved on this device.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as Theme[]).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setTheme(option); setThemeState(option); }}
                  className={`clay-btn py-3 rounded-[14px] font-black text-sm min-h-[44px] ${
                    theme === option ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
                  }`}>
                  {option === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>
          <div className="clay p-3 flex flex-col gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Notifications</p>
            <p className="text-xs font-semibold text-stone-500 leading-relaxed">
              Get a short welcome notification on your first visit each day (works best from home-screen app).
            </p>
            <button
              type="button"
              onClick={toggleNotifications}
              className={`clay-btn flex items-center justify-between px-4 py-3 rounded-[14px] font-bold text-sm min-h-[44px] ${
                notifOn ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>
              <span>🔔 Daily reminder</span>
              <span className="text-xs font-black">{notifOn ? 'ON' : 'OFF'}</span>
            </button>
            {notifMsg && <p className="text-xs font-semibold text-violet-700">{notifMsg}</p>}
          </div>

          <div className="clay p-3 flex flex-col gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Credit Cards</p>
            <p className="text-xs font-semibold text-stone-500 leading-relaxed">
              Track credit card spending and outstanding balances separately from your bank wallets.
            </p>
            <button
              type="button"
              onClick={() => { const next = !ccOn; setCcOn(next); setCreditCardsEnabled(next); }}
              className={`clay-btn flex items-center justify-between px-4 py-3 rounded-[14px] font-bold text-sm min-h-[44px] ${
                ccOn ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>
              <span>💳 Credit card wallets</span>
              <span className="text-xs font-black">{ccOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="clay p-3 flex flex-col gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Split Groups</p>
            <p className="text-xs font-semibold text-stone-500 leading-relaxed">
              Track shared expenses with friends. See who owes who and settle up easily — no one else needs the app.
            </p>
            <button
              type="button"
              onClick={() => { const next = !splitOn; setSplitOn(next); setSplitEnabled(next); }}
              className={`clay-btn flex items-center justify-between px-4 py-3 rounded-[14px] font-bold text-sm min-h-[44px] ${
                splitOn ? 'clay-purple text-violet-900' : 'bg-stone-100 text-stone-500 border border-stone-200 shadow-none'
              }`}>
              <span>✂️ Split groups</span>
              <span className="text-xs font-black">{splitOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="clay p-3 flex flex-col gap-1">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Categories</p>
            <p className="text-xs font-semibold text-stone-500 leading-relaxed">
              Tag income and expenses (for example, Personal or Business). Wallet transfers are handled separately from categories.
            </p>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm font-semibold text-stone-400 text-center py-4 clay rounded-[14px]">
              No categories yet. Add one below!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="clay p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="font-black text-stone-800 flex-1">{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      className="clay-btn text-rose-400 text-xs px-2 py-1 rounded-[8px]">
                      Delete
                    </button>
                  </div>

                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-stone-400">Budget</span>
                    <span className="text-stone-400 font-black">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={budgetDrafts[cat.id] ?? ''}
                      onChange={e => setBudgetDrafts(d => ({ ...d, [cat.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                      onKeyDown={e => e.key === 'Enter' && saveBudget(cat.id)}
                      placeholder="Monthly limit"
                      className="clay flex-1 px-3 py-2.5 font-bold text-stone-700 bg-transparent outline-none placeholder:text-stone-400"
                    />
                    <button
                      type="button"
                      onClick={() => saveBudget(cat.id)}
                      className="clay-btn bg-violet-500 text-white font-black text-xs px-2.5 py-2 rounded-[8px]">
                      Save
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-stone-400 whitespace-nowrap">Default wallet</span>
                    <select
                      value={cat.walletId ?? ''}
                      onChange={e => { updateCategory(cat.id, { walletId: e.target.value || undefined }); reload(); onChange(); }}
                      className="clay flex-1 px-3 py-2.5 font-bold text-stone-700 bg-transparent outline-none min-h-[44px]"
                      aria-label={`Default wallet for ${cat.name}`}>
                      <option value="">First wallet</option>
                      {wallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.emoji} {wallet.name}</option>)}
                    </select>
                  </div>
                  {cat.budget > 0 && (
                    <p className="text-[10px] font-bold text-violet-600">Budget set: {fmt(cat.budget)}/month</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="clay p-3 flex flex-col gap-2">
            <p className="text-xs font-black text-stone-500 uppercase tracking-wide">Add category</p>
            <div className="flex gap-2 items-center">
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} label="Category icon" />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Personal, Business"
                className="clay flex-1 px-3 py-2.5 font-bold text-stone-700 bg-transparent outline-none placeholder:text-stone-400"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="clay-btn py-3 bg-violet-500 text-white font-black rounded-[12px] disabled:opacity-40">
              + Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
