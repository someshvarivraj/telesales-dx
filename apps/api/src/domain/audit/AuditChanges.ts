import type { AuditChangeDto } from '@telesales/shared';

/** Keys that never help a person reading the history. */
const HIDDEN_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'expectedUpdatedAt', 'passwordHash']);
const MAX_TEXT = 80;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const jst = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

/**
 * Turns the before/after snapshots of an audit entry into the fields that changed, with
 * values as short display text (dates in JST, yes/no, lists joined). Ids of people are
 * left as ids here; `AuditChanges.names` collects them so the caller can swap in names.
 */
export class AuditChanges {
  constructor(private readonly names: ReadonlyMap<string, string> = new Map()) {}

  /** Every id-looking value in the snapshots, to look up names in one query. */
  static ids(...snapshots: unknown[]): string[] {
    const found = new Set<string>();
    const walk = (value: unknown) => {
      if (typeof value === 'string' && UUID.test(value)) found.add(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (isRecord(value)) Object.values(value).forEach(walk);
    };
    snapshots.forEach(walk);
    return [...found];
  }

  between(before: unknown, after: unknown): AuditChangeDto[] {
    const was = isRecord(before) ? before : {};
    const now = isRecord(after) ? after : {};
    const keys = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter(
      (key) => !HIDDEN_KEYS.has(key) && !/hash$/i.test(key),
    );
    const changes: AuditChangeDto[] = [];
    for (const field of keys) {
      const from = this.text(was[field]);
      const to = this.text(now[field]);
      if (from !== to) changes.push({ field, before: from, after: to });
    }
    return changes;
  }

  text(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      if (UUID.test(value)) return this.names.get(value) ?? '（ID）';
      if (ISO_DATE_TIME.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return jst.format(date);
      }
      if (ISO_DATE.test(value)) return value.replaceAll('-', '/');
      return clip(value);
    }
    if (Array.isArray(value)) {
      const parts = value.map((item) => this.text(item)).filter((item) => item !== null);
      return parts.length > 0 ? clip(parts.join('、')) : null;
    }
    return clip(JSON.stringify(value));
  }
}
