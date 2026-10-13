import { Phone } from 'lucide-react';

export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 items-center justify-center rounded-lg bg-main text-white"
    >
      <Phone className="size-4" strokeWidth={2.5} />
    </span>
  );
}
