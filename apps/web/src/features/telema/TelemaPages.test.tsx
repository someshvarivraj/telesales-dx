import {
  type AllocationDayResponse,
  addDays,
  resolvePermissions,
  Role,
  type SessionUser,
  type ShiftMonthResponse,
} from '@telesales/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { todayJst } from '@/lib/format';
import { sessionQueryKey } from '../auth/hooks/useSession';
import { AllocationPage } from './AllocationPage';
import { telemaKeys } from './api';
import { ShiftsPage } from './ShiftsPage';

const ME = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';
const today = todayJst();
const month = today.slice(0, 7);

function renderAs(roles: Role[], element: ReactNode, data: [readonly unknown[], unknown][]) {
  const user: SessionUser = {
    id: ME,
    employeeNo: null,
    email: 'me@example.co.jp',
    name: '自分',
    roles,
    permissions: resolvePermissions(roles),
    mustChangePassword: false,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(sessionQueryKey, user);
  data.forEach(([key, value]) => queryClient.setQueryData(key, value));
  const router = createMemoryRouter([{ path: '/', element }], { initialEntries: ['/'] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const person = (id: string, name: string) => ({
  user: { id, name },
  roles: [Role.Telema],
  jobType: null,
  isAllocationTarget: true,
  territory: [],
  usualStart: '09:00',
  usualEnd: '18:00',
  usualBreakMinutes: 60,
  usualWeekdays: [1, 2, 3, 4, 5],
});

const shiftMonth: ShiftMonthResponse = {
  month,
  days: [addDays(today, -1), today].map((date) => ({
    date,
    businessDay: true,
    holidayName: null,
  })),
  people: [person(ME, '自分'), person(OTHER, '同僚')],
  shifts: [
    {
      id: 's1',
      userId: ME,
      date: today,
      kind: 'WORK',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      workingMinutes: 480,
      note: null,
      enteredBy: null,
      updatedAt: new Date().toISOString(),
    },
  ],
};

describe('ShiftsPage', () => {
  it('lets a telemarketer edit their own days and only today onwards for others', () => {
    renderAs([Role.Telema], <ShiftsPage />, [[telemaKeys.shifts(month), shiftMonth]]);
    expect(screen.getByRole('button', { name: `自分 ${today} 09:00〜18:00` })).toBeEnabled();
    expect(screen.getByRole('button', { name: `同僚 ${today} 未入力` })).toBeEnabled();
    if (addDays(today, -1).startsWith(month)) {
      expect(
        screen.getByRole('button', { name: `同僚 ${addDays(today, -1)} 未入力` }),
      ).toBeDisabled();
    }
  });

  it('shows the monthly total of working hours', () => {
    renderAs([Role.Telema], <ShiftsPage />, [[telemaKeys.shifts(month), shiftMonth]]);
    expect(screen.getByText('8時間')).toBeInTheDocument();
  });
});

const draft: AllocationDayResponse = {
  date: today,
  businessDay: true,
  state: 'DRAFT',
  confirmedAt: null,
  confirmedBy: null,
  fixedTerritory: ['京都府'],
  targets: [
    { user: { id: ME, name: '自分' }, workingMinutes: 480, share: 2 / 3, calls: 2, dayBefore: 0 },
    {
      user: { id: OTHER, name: '同僚' },
      workingMinutes: 240,
      share: 1 / 3,
      calls: 1,
      dayBefore: 0,
    },
  ],
  dayBeforeDates: [addDays(today, 1)],
  items: [
    {
      id: 'a1',
      kind: 'CALL',
      assignee: { id: ME, name: '自分' },
      status: 'DRAFT',
      company: {
        id: 'c1',
        name: '株式会社テスト',
        phone: null,
        prefecture: '大阪府',
        city: '大阪市',
        listName: null,
      },
      appointment: null,
    },
  ],
};

describe('AllocationPage', () => {
  it('lets a lead confirm a draft and move items', () => {
    renderAs([Role.TelemaLead], <AllocationPage />, [[telemaKeys.allocation(today), draft]]);
    expect(screen.getByRole('button', { name: '確定して各自に知らせる' })).toBeEnabled();
    expect(screen.getByRole('link', { name: '株式会社テスト' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText(/京都府 の企業は外します/)).toBeInTheDocument();
  });

  it('hides a draft from telemarketers until it is confirmed', () => {
    renderAs([Role.Telema], <AllocationPage />, [
      [telemaKeys.allocation(today), { ...draft, items: [], targets: [] }],
    ]);
    expect(screen.getByText('リーダーが確定すると、ここに出ます。')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '確定して各自に知らせる' }),
    ).not.toBeInTheDocument();
  });
});
