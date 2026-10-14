import type { UserRef } from '@telesales/shared';

export function iso(value: Date): string;
export function iso(value: Date | null | undefined): string | null;
export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Prisma returns @db.Date columns as UTC midnight. */
export function dateOnly(value: Date): string;
export function dateOnly(value: Date | null | undefined): string | null;
export function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** 'YYYY-MM-DD' → value for a @db.Date column. */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function userRef(user: { id: string; name: string }): UserRef;
export function userRef(user: { id: string; name: string } | null | undefined): UserRef | null;
export function userRef(user: { id: string; name: string } | null | undefined): UserRef | null {
  return user ? { id: user.id, name: user.name } : null;
}

export const userRefSelect = { select: { id: true, name: true } } as const;
