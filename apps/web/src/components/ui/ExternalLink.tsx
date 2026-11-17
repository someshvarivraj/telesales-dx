import type { ReactNode } from 'react';

/**
 * A stored address as a link only when it is a web page (11/18 audit): http(s) as it is, a bare
 * domain such as 「www.example.co.jp」 (common in imported lists) with https:// in front.
 * Anything else — `javascript:`, `data:`, plain notes — is shown as text, never as a link.
 */
export function webUrlOf(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text || /\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(text)
  ) {
    return `https://${text}`;
  }
  return null;
}

/** Opens in a new tab without giving the page access back to the app. */
export function ExternalLink({
  value,
  className = 'break-all text-link',
}: {
  value: string | null | undefined;
  className?: string;
}): ReactNode {
  if (!value) return null;
  const href = webUrlOf(value);
  if (!href) return <span className="break-all">{value}</span>;
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer noopener">
      {value}
    </a>
  );
}
