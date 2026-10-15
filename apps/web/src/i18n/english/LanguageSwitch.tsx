import { ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { currentLanguage, type Language, switchLanguage } from './language';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

/** 日本語 / English (temporary, for the team; the labels themselves are never translated). */
export function LanguageSwitch({ className }: { className?: string }) {
  const language = currentLanguage();
  return (
    <label
      data-no-translate
      className={cn(
        'relative inline-flex h-10 items-center gap-2 border border-line-strong bg-surface pr-8 pl-3 text-sm font-medium text-ink hover:border-main-line',
        className,
      )}
    >
      <span className="sr-only">Language / 言語</span>
      {language === 'ja' ? (
        <span
          aria-hidden="true"
          className="relative size-5 shrink-0 rounded-full! border border-line bg-white"
        >
          <span className="absolute inset-1 rounded-full! bg-[#bc002d]" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="flex h-5 shrink-0 items-center bg-schedule px-1 text-[10px] font-bold text-white"
        >
          EN
        </span>
      )}
      <select
        value={language}
        onChange={(e) => switchLanguage(e.target.value as Language)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true">{OPTIONS.find((option) => option.value === language)?.label}</span>
      <ChevronDown aria-hidden="true" className="absolute right-2.5 size-4 text-ink-sub" />
    </label>
  );
}
