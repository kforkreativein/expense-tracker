'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function EntrySearch({ value, onChange }: Props) {
  return (
    <div className="clay flex items-center gap-2 px-4 py-3 min-h-[48px] min-w-0 overflow-hidden">
      <span className="text-base shrink-0" aria-hidden>🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search entries"
        className="flex-1 min-w-0 w-full bg-transparent outline-none font-semibold text-stone-700 placeholder:text-stone-400"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="clay-btn text-stone-400 font-black text-sm px-2 min-h-[44px]">
          ✕
        </button>
      )}
    </div>
  );
}
