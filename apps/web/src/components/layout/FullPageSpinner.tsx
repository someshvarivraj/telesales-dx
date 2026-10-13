import { Spinner } from '@/components/ui/Spinner';
import { ja } from '@/i18n/ja';

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-ink-sub">
      <Spinner className="size-6" label={ja.common.loading} />
    </div>
  );
}
