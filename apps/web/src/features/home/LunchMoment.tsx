import { useState } from 'react';
import { todayJst } from '@/lib/format';

/**
 * A small lunchtime moment on the home screen, so the app feels like someone cares:
 * 12–13 MoraBot munches an onigiri; 13–14 it asks how lunch was (once a day per person)
 * and answers politely. Formal Japanese, as at work.
 */
export type LunchPhase = 'eating' | 'asking' | null;

export function lunchPhase(hour: number): LunchPhase {
  if (hour === 12) return 'eating';
  if (hour === 13) return 'asking';
  return null;
}

export const LUNCH_ANSWERS = [
  {
    key: 'good',
    label: 'おいしかったです',
    reply: 'それはよかったです！午後もどうぞよろしくお願いいたします。',
  },
  {
    key: 'ok',
    label: 'ふつうでした',
    reply: 'しっかり休めましたか？午後もご無理のないようにお願いいたします。',
  },
  {
    key: 'notyet',
    label: 'まだです',
    reply: 'お忙しいところおつかれさまです。少しでも休憩をお取りくださいね。',
  },
] as const;

type AnswerKey = (typeof LUNCH_ANSWERS)[number]['key'];

const storageKey = (userId: string) => `telesales.lunch.${userId}.${todayJst()}`;

function savedAnswer(userId: string): AnswerKey | null {
  try {
    const value = localStorage.getItem(storageKey(userId));
    return LUNCH_ANSWERS.some((a) => a.key === value) ? (value as AnswerKey) : null;
  } catch {
    return null;
  }
}

/** The onigiri MoraBot is eating, with a もぐもぐ that pops now and then. */
export function Onigiri() {
  return (
    <span aria-hidden="true" className="lunch-onigiri">
      <svg viewBox="0 0 64 60" className="size-full">
        <path
          d="M32 4c6 0 27 39 25 46-2 7-48 7-50 0C5 43 26 4 32 4Z"
          fill="#fff"
          stroke="#1e2530"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="21" y="38" width="22" height="17" rx="2" fill="#1f2937" />
        <circle cx="25" cy="24" r="1.6" fill="#1e2530" opacity=".25" />
        <circle cx="38" cy="30" r="1.6" fill="#1e2530" opacity=".25" />
      </svg>
      <span className="lunch-mogu">もぐもぐ</span>
    </span>
  );
}

/** Hearts that float up once, when MoraBot is happy about the answer. */
export function Hearts() {
  return (
    <span aria-hidden="true" className="lunch-hearts">
      <i>♥</i>
      <i>♥</i>
      <i>♥</i>
    </span>
  );
}

/**
 * 「お昼ごはんはいかがでしたか？」 with three answers; after an answer, MoraBot's reply.
 * `onAnswer` lets the page make MoraBot react (hop, hearts).
 */
export function LunchQuestion({
  userId,
  onAnswer,
}: {
  userId: string;
  onAnswer: (key: AnswerKey) => void;
}) {
  const [answer, setAnswer] = useState<AnswerKey | null>(() => savedAnswer(userId));
  const [justAnswered, setJustAnswered] = useState(false);
  const chosen = LUNCH_ANSWERS.find((a) => a.key === answer);

  if (chosen && !justAnswered) {
    // Asked already today: keep the screen calm.
    return null;
  }
  if (chosen) {
    return (
      <p
        key={chosen.key}
        aria-live="polite"
        className="morabot-cheer-bubble mb-1.5 inline-block bg-main-soft px-2.5 py-1 text-xs font-bold text-main"
      >
        {chosen.reply}
      </p>
    );
  }
  return (
    <div className="morabot-cheer-bubble mb-2">
      <p className="mb-1.5 inline-block bg-main-soft px-2.5 py-1 text-xs font-bold text-main">
        お昼ごはんはいかがでしたか？
      </p>
      <div className="flex flex-wrap gap-1.5">
        {LUNCH_ANSWERS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(storageKey(userId), a.key);
              } catch {
                // Storage blocked: it may ask again after a reload.
              }
              setAnswer(a.key);
              setJustAnswered(true);
              onAnswer(a.key);
            }}
            className="h-8 cursor-pointer border border-main-line bg-surface px-3 text-xs font-bold text-main transition-colors hover:bg-main-soft"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
