'use client';

export type AppTab = 'home' | 'insights' | 'split' | 'tools' | 'settings';

interface Props {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
  onAdd: () => void;
}

function IconWrap({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-[#2563eb] text-white' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export default function BottomDock({ tab, onTab, onAdd }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav
        className="pointer-events-auto flex h-[58px] items-center gap-1 rounded-full border border-white/10 bg-[#1c1c1e]/90 px-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        aria-label="Main"
      >
        <IconWrap active={tab === 'home'} label="Home" onClick={() => onTab('home')}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
          </svg>
        </IconWrap>
        <IconWrap active={tab === 'insights'} label="Insights" onClick={() => onTab('insights')}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 4.5c.8 2.4 2.6 4.2 5 5-2.4.8-4.2 2.6-5 5-.8-2.4-2.6-4.2-5-5 2.4-.8 4.2-2.6 5-5z" />
            <path d="M7 14.5c.4 1.2 1.3 2.1 2.5 2.5-1.2.4-2.1 1.3-2.5 2.5-.4-1.2-1.3-2.1-2.5-2.5 1.2-.4 2.1-1.3 2.5-2.5z" />
          </svg>
        </IconWrap>
        <IconWrap active={tab === 'split'} label="Split" onClick={() => onTab('split')}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M7 9h10M7 15h10" strokeLinecap="round" />
          </svg>
        </IconWrap>
        <IconWrap active={tab === 'tools'} label="Financial tools" onClick={() => onTab('tools')}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="6" y="4" width="12" height="16" rx="2" />
            <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
          </svg>
        </IconWrap>
        <IconWrap active={tab === 'settings'} label="Settings" onClick={() => onTab('settings')}>
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              strokeLinejoin="round"
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            />
          </svg>
        </IconWrap>
      </nav>

      <button
        type="button"
        aria-label="Add income or expense"
        onClick={onAdd}
        className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-[0_8px_24px_rgba(34,197,94,0.45)]"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 6v12M6 12h12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
