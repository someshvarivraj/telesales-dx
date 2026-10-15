import { MoraBot } from '@/components/brand/MoraBot';

/** The logo mark: MoraBot's head, as on the skill sheet system. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center">
      <MoraBot headOnly size={size} title="" />
    </span>
  );
}
