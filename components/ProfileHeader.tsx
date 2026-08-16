'use client';
import { useState, useEffect } from 'react';
import { getSession, updateDisplayName, logout } from '@/lib/auth';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  streak: number;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export default function ProfileHeader({ streak, onLogout, onOpenSettings }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setName(session.displayName);
      setUsername(session.username);
    }
  }, []);

  function saveName() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    updateDisplayName(trimmed);
    setName(trimmed);
    setShowModal(false);
  }

  function openEdit() {
    setDraft(name ?? '');
    setShowModal(true);
    setShowMenu(false);
  }

  function handleLogout() {
    logout();
    setShowMenu(false);
    onLogout();
  }

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}>
          <div
            className="clay animate-bounce-in w-full max-w-sm p-7 flex flex-col items-center gap-5 text-center"
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}>
            <span className="text-5xl">✏️</span>
            <h2 className="text-2xl font-black text-stone-800">Edit your name</h2>
            <p className="text-sm font-semibold text-stone-500">So I can greet you properly!</p>
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Your first name"
              className="clay w-full px-4 py-3 text-lg font-bold text-stone-800 bg-transparent outline-none text-center placeholder:text-stone-400"
            />
            <div className="flex gap-2 w-full">
              <button onClick={() => setShowModal(false)}
                className="clay-btn flex-1 py-3 rounded-[16px] font-black text-stone-600 text-base bg-stone-100">
                Cancel
              </button>
              <button onClick={saveName}
                disabled={!draft.trim()}
                className="clay-btn flex-1 py-3 rounded-[16px] font-black text-white text-base bg-violet-500 shadow-lg disabled:opacity-40">
                Save ✅
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden="true"
            style={{
              backgroundImage: 'url(/money-buddy-logo.svg)',
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
            className="h-[52px] w-[52px] shrink-0 rounded-[18px] shadow-[var(--surface-shadow)]"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{getGreeting()}</p>
            <h1 className="text-2xl font-black text-stone-800 leading-tight truncate">
              Hey {name ?? ''}!
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs font-semibold text-stone-400">@{username}</p>
              {streak > 0 && (
                <span className="text-[10px] font-black text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">
                  🔥 {streak} day{streak === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            aria-label="Account menu"
            className="clay clay-btn w-11 h-11 flex items-center justify-center text-xl rounded-[14px]">
            👤
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-12 z-50 clay animate-pop-in p-2 min-w-[160px] flex flex-col gap-1">
                <button onClick={() => { setShowMenu(false); onOpenSettings(); }}
                  className="clay-btn text-left px-3 py-2.5 text-sm font-bold text-stone-700 rounded-[10px] hover:bg-violet-50">
                  ⚙️ Settings
                </button>
                <button onClick={openEdit}
                  className="clay-btn text-left px-3 py-2.5 text-sm font-bold text-stone-700 rounded-[10px] hover:bg-violet-50">
                  ✏️ Edit name
                </button>
                <button onClick={handleLogout}
                  className="clay-btn text-left px-3 py-2.5 text-sm font-bold text-rose-500 rounded-[10px] hover:bg-rose-50">
                  🚪 Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
