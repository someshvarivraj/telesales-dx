import { describe, expect, it } from 'vitest';
import { MANUAL } from '../src/modules/assistant/manual.js';

/** The app's screens (apps/web/src/app/paths.ts); ids are written as {…} in the guide. */
const ROUTES = [
  '/password',
  '/home',
  '/notifications',
  '/calls',
  '/calls/import',
  '/calls/imports',
  '/calls/duplicates',
  '/calls/avoid',
  '/calls/companies/{ID}',
  '/calls/companies/{企業ID}',
  '/schedule',
  '/schedule/book',
  '/schedule/print',
  '/appointments',
  '/appointments/{ID}',
  '/appointments/{アポID}',
  '/appointments/{ID}/mail/booking',
  '/appointments/day-before',
  '/appointments/change-requests',
  '/appointments/next-actions',
  '/telema',
  '/telema/shifts',
  '/telema/allocation',
  '/telema/results',
  '/telema/people',
  '/admin',
  '/admin/users',
  '/admin/feedback',
  '/admin/area-table',
  '/admin/calendar',
  '/admin/options',
  '/admin/notices',
  '/admin/locks',
  '/admin/settings',
  '/admin/apps',
  '/admin/audit',
];

describe('MoraBot operating guide', () => {
  it('links only to screens that exist', () => {
    const linked = [...MANUAL.matchAll(/（(\/[^）、\s]*)）/g)].map((match) => match[1]);
    expect(linked.length).toBeGreaterThan(30);
    expect(linked.filter((path) => !ROUTES.includes(path ?? ''))).toEqual([]);
  });

  it('has a step-by-step flow for every role', () => {
    for (const role of [
      '### テレマ',
      '### テレマリーダー',
      '### 営業',
      '### 管理者',
      '### 閲覧のみ',
    ]) {
      expect(MANUAL).toContain(role);
    }
  });
});
