import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { todayJst } from '@/lib/format';

/** Only good fortunes (11/16): a small lift at the start of the day, with a lucky item. */
export const OMIKUJI = [
  { rank: '大吉', text: '今日はアポが取れる日！思いきって電話を。', lucky: '温かいお茶' },
  { rank: '大吉', text: 'いい知らせが届きそう。メールをこまめに確認。', lucky: '青いペン' },
  { rank: '中吉', text: 'いい商談になりそう。準備がそのまま力に。', lucky: '付箋' },
  { rank: '中吉', text: '笑顔の一言が流れを変えます。', lucky: 'おにぎり' },
  { rank: '吉', text: '一本の電話がご縁につながります。', lucky: '手帳' },
  { rank: '吉', text: '午前中の段取りが午後を楽にします。', lucky: 'コーヒー' },
  { rank: '小吉', text: 'コツコツが実を結ぶ日。記録を丁寧に。', lucky: '黄色いもの' },
  { rank: '末吉', text: '午後から運気上昇。最後のひと押しを。', lucky: 'チョコレート' },
] as const;

const storageKey = (userId: string, date: string) => `telesales.omikuji.${userId}.${date}`;

function read(userId: string, date: string): number | null {
  try {
    const value = localStorage.getItem(storageKey(userId, date));
    const index = value === null ? NaN : Number(value);
    return Number.isInteger(index) && index >= 0 && index < OMIKUJI.length ? index : null;
  } catch {
    return null;
  }
}

/** The omikuji box (御神籤の箱): a hexagonal box with a stick poking out. */
function OmikujiBox({ shaking }: { shaking: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      aria-hidden="true"
      className={cn('h-12 w-10 shrink-0', shaking && 'omikuji-shake')}
    >
      <rect x="22" y="2" width="4" height="14" rx="1" fill="#e9d7a8" stroke="#b8913f" />
      <path d="M8 16h32l4 6v26l-4 6H8l-4-6V22z" fill="#d6401f" stroke="#a82c14" strokeWidth="1.5" />
      <path d="M8 16l4 6h24l4-6" fill="#e2593a" stroke="#a82c14" strokeWidth="1.2" />
      <rect x="15" y="27" width="18" height="20" fill="#fffaf0" />
      <text
        x="24"
        y="42"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#a82c14"
        fontFamily="'Hiragino Mincho ProN','Yu Mincho',serif"
      >
        籤
      </text>
    </svg>
  );
}

/**
 * 今日のおみくじ (11/16) on the home page: one draw a day per person, kept in this browser.
 * The box shakes, then the slip opens with the fortune. Good fortunes only.
 */
export function DailyOmikuji({ userId }: { userId: string }) {
  const today = todayJst();
  const [index, setIndex] = useState<number | null>(() => read(userId, today));
  const [shaking, setShaking] = useState(false);
  const fortune = index === null ? null : OMIKUJI[index];

  const draw = () => {
    if (shaking || fortune) return;
    setShaking(true);
    window.setTimeout(() => {
      const next = Math.floor(Math.random() * OMIKUJI.length);
      try {
        localStorage.setItem(storageKey(userId, today), String(next));
      } catch {
        // Storage blocked: another draw is possible after a reload.
      }
      setIndex(next);
      setShaking(false);
    }, 650);
  };

  return (
    <section
      aria-label="今日のおみくじ"
      className="flex items-center gap-4 border border-line bg-surface px-5 py-3.5 shadow-(--shadow-card) max-sm:px-4"
    >
      <OmikujiBox shaking={shaking} />
      {fortune ? (
        <div
          key={index}
          className="omikuji-open flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-[#d6401f] bg-[#fffdf6] font-[Hiragino_Mincho_ProN,Yu_Mincho,serif] text-lg font-bold text-[#d6401f]">
            {fortune.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink-sub">今日のおみくじ</p>
            <p className="text-sm font-bold text-ink">{fortune.text}</p>
            <p className="text-xs text-ink-sub">ラッキーアイテム：{fortune.lucky}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">今日のおみくじ</p>
            <p className="text-xs text-ink-sub">1日1回。今日の運勢を引いてみませんか？</p>
          </div>
          <button
            type="button"
            onClick={draw}
            disabled={shaking}
            className="h-9 cursor-pointer border border-[#d6401f] bg-[#fffdf6] px-4 text-sm font-bold text-[#d6401f] transition-colors hover:bg-[#d6401f] hover:text-white disabled:cursor-wait"
          >
            {shaking ? '…' : 'おみくじを引く'}
          </button>
        </div>
      )}
    </section>
  );
}
