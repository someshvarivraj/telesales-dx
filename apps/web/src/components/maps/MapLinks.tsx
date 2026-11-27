import { ExternalLink, MapPinned, TrainFront } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/** 「近鉄 大和八木駅 徒歩8分」 → 「大和八木」: the station name 乗換案内 understands. */
export function stationName(text: string | null | undefined): string | null {
  const value = (text ?? '').normalize('NFKC').trim();
  if (!value) return null;
  const match = value.match(/([^\s、,（(／/]+?)駅/);
  const name = (match?.[1] ?? value.split(/[\s、,（(]/)[0] ?? '').trim();
  // 「JR大阪駅」: the line in front is not part of the station's name.
  return name.replace(/^(JR|地下鉄|市営地下鉄)/, '') || null;
}

/** Yahoo!マップ route search with the place as the goal and the start left empty. */
export function yahooMapRouteUrl(address: string): string {
  return `https://map.yahoo.co.jp/route/train?from=&to=${encodeURIComponent(address)}`;
}

/** Yahoo!乗換案内 with the place as the destination and the start left empty. */
export function yahooTransitUrl(destination: string): string {
  return `https://transit.yahoo.co.jp/?from=&to=${encodeURIComponent(destination)}`;
}

/**
 * Two buttons next to an address (request 11/27): the route on Yahoo!マップ and Yahoo!乗換案内,
 * with the place as the destination and the starting point left for the person to fill in.
 */
export function MapLinks({
  address,
  station,
  className,
  compact = false,
}: {
  address: string | null | undefined;
  /** 最寄駅: 乗換案内 goes to the station; without one, to the address. */
  station?: string | null;
  className?: string;
  /** Icons only (in tables). */
  compact?: boolean;
}) {
  const place = (address ?? '').trim();
  if (!place) return null;
  const destination = stationName(station) ?? place;
  const link =
    'inline-flex shrink-0 items-center gap-1 border border-line bg-surface text-xs font-bold text-link transition-colors hover:border-main-line hover:bg-main-soft';
  return (
    <span className={cn('inline-flex flex-wrap gap-1.5', className)}>
      <a
        href={yahooMapRouteUrl(place)}
        target="_blank"
        rel="noopener noreferrer"
        // Inside a clickable row (the office table): open the map, do not pick the row.
        onClick={(event) => event.stopPropagation()}
        title="Yahoo!マップでルートを調べる（出発地は空欄）"
        aria-label={compact ? 'Yahoo!マップでルート' : undefined}
        className={cn(link, compact ? 'size-7 justify-center' : 'h-7 px-2')}
      >
        <MapPinned aria-hidden="true" className="size-3.5" />
        {!compact && (
          <>
            Yahoo!マップ
            <ExternalLink aria-hidden="true" className="size-3 opacity-60" />
          </>
        )}
      </a>
      <a
        href={yahooTransitUrl(destination)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        title={`乗換案内で「${destination}」までを調べる（出発地は空欄）`}
        aria-label={compact ? '乗換案内' : undefined}
        className={cn(link, compact ? 'size-7 justify-center' : 'h-7 px-2')}
      >
        <TrainFront aria-hidden="true" className="size-3.5" />
        {!compact && (
          <>
            乗換案内
            <ExternalLink aria-hidden="true" className="size-3 opacity-60" />
          </>
        )}
      </a>
    </span>
  );
}

/** An address with the two map buttons under it. */
export function AddressWithMaps({
  address,
  station,
}: {
  address: string | null | undefined;
  station?: string | null;
}) {
  if (!address) return null;
  return (
    <span className="flex flex-col gap-1.5">
      <span>{address}</span>
      <MapLinks address={address} station={station} />
    </span>
  );
}
