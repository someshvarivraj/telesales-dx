import { Select, type SelectOption } from '@/components/ui/Select';
import { currentLanguage, type Language, switchLanguage } from './language';

const OPTIONS: SelectOption[] = [
  {
    value: 'ja',
    label: '日本語',
    icon: (
      <span
        aria-hidden="true"
        className="relative size-4.5 shrink-0 rounded-full! border border-line bg-white"
      >
        <span className="absolute inset-[3px] rounded-full! bg-[#bc002d]" />
      </span>
    ),
  },
  {
    value: 'en',
    label: 'English',
    icon: (
      <span
        aria-hidden="true"
        className="flex h-4.5 shrink-0 items-center bg-schedule px-1 text-[10px] font-bold text-white"
      >
        EN
      </span>
    ),
  },
];

/** 日本語 / English (temporary, for the team; the labels themselves are never translated). */
export function LanguageSwitch({ className }: { className?: string }) {
  return (
    <div data-no-translate className={className}>
      <Select
        size="sm"
        aria-label="Language / 言語"
        options={OPTIONS}
        value={currentLanguage()}
        onChange={(event) => switchLanguage(event.target.value as Language)}
      />
    </div>
  );
}
