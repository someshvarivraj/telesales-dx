import { addDays, isWeekend, jstMinutesOfDay, Permission, weekdayJa } from '@telesales/shared';
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Keyboard,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { QueryState } from '@/components/ui/QueryState';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { formatTime, monthRange, startOfWeek, todayJst } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { AgendaView } from './AgendaView';
import { useSchedule } from './api';
import { existingListBookingHref } from './bookingLinks';
import { useEventPeek } from './calendar/EventPeek';
import { DayTimeline } from './calendar/DayTimeline';
import { busyRanges, freeMinutes, hoursLabel, WORK_END, WORK_START } from './calendar/layout';
import { MemberMenu, PAGE_SIZE } from './calendar/MemberMenu';
import type { SavedGroup } from './calendar/MemberPicker';
import { MiniMonth } from './calendar/MiniMonth';
import { TimeGrid, useNow } from './calendar/TimeGrid';
import { DayView } from './DayView';
import { EventDetailDialog } from './EventDetailDialog';
import {
  buildEvents,
  type CalendarEvent,
  EVENT_STYLE,
  type EventKind,
  eventsOn,
  minutesWithin,
} from './events';
import { MonthView } from './MonthView';
import { PlanDialog } from './PlanDialog';
import { TimeOffDialog } from './TimeOffDialog';
import { WeekView } from './WeekView';

type View = 'day' | 'week' | 'month' | 'list';

const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: 'day', label: '日', hint: '日（D）' },
  { value: 'week', label: '週', hint: '週（W）' },
  { value: 'month', label: '月', hint: '月（M）' },
  { value: 'list', label: 'リスト', hint: 'リスト（L）' },
];

const KINDS: EventKind[] = [
  'appointment',
  'salesAppointment',
  'plan',
  'tentative',
  'attending',
  'timeoff',
  'lock',
];

const ZOOMS = [0.75, 1, 1.4, 1.9];
const LIST_DAYS = 14;
/** More people than this and the day is drawn as rows (timeline) instead of columns. */
const DAY_COLUMNS_MAX = 6;

function rangeFor(view: View, date: string): { from: string; to: string } {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const start = startOfWeek(date);
    return { from: start, to: addDays(start, 6) };
  }
  if (view === 'list') return { from: date, to: addDays(date, LIST_DAYS - 1) };
  const month = monthRange(date);
  return { from: startOfWeek(month.from), to: addDays(startOfWeek(month.to), 6) };
}

/** Per-viewer display preferences (zoom, free time, hidden kinds); never required. */
function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`telesales.schedule.${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(`telesales.schedule.${key}`, JSON.stringify(next));
    } catch {
      // Private mode or blocked storage: the preference just isn't remembered.
    }
  };
  return [value, set];
}

const SHORTCUTS: [string, string][] = [
  ['T', '今日へ'],
  ['← / →', '前へ・次へ'],
  ['D・W・M・L', '日・週・月・リスト'],
  ['/', '予定を検索'],
  ['F', '空き時間の表示を切り替え'],
  ['+ / −', '時間の幅を広げる・狭める'],
  ['N', '予定を追加'],
  ['?', 'このショートカット一覧'],
];

/** ② The single sales schedule: day / week / month / list, other reps too (spec §6). */
export function SchedulePage() {
  const user = useCurrentUser();
  const pageRef = useRef<HTMLDivElement>(null);
  const fullScreen = useFullScreen(pageRef);
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? todayJst();
  const view =
    (params.get('view') as View | null) ??
    (window.matchMedia?.('(max-width: 640px)').matches ? 'list' : 'week');
  // ?person= (one) is still read so old links keep working.
  const chosen = (params.get('people') ?? params.get('person') ?? '').split(',').filter(Boolean);
  const canPlans = usePermission(Permission.WriteSalesPlans);
  const isAdmin = usePermission(Permission.Administer);
  const canShifts = usePermission(Permission.WriteShifts);
  const canWritePlans = canPlans || isAdmin;
  const canTimeOff = canWritePlans || canShifts;
  const canSalesBook = usePermission(Permission.ManageSalesAppointments);
  const canTelemaBook = usePermission(Permission.ManageTelemaAppointments);

  const { from, to } = rangeFor(view, date);
  const schedule = useSchedule(from, to, []);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [planDialog, setPlanDialog] = useState<{
    event?: CalendarEvent;
    defaults?: { ownerId: string; date: string; time?: string; endTime?: string };
  } | null>(null);
  const [timeOffDialog, setTimeOffDialog] = useState<{ userId: string; date: string } | null>(null);
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = usePref('zoom', 1);
  const [showFree, setShowFree] = usePref('free', false);
  const [hidden, setHidden] = usePref<EventKind[]>('hiddenKinds', []);
  const [railOpen, setRailOpen] = usePref('rail', true);
  const [sort, setSort] = usePref<'name' | 'free' | 'busy'>('sort', 'name');
  const [groups, setGroups] = usePref<SavedGroup[]>('groups', []);
  const [page, setPage] = useState(0);
  const [help, setHelp] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const peek = useEventPeek();
  const now = useNow();

  const update = (next: Partial<{ date: string; view: View; people: string }>) => {
    const merged = new URLSearchParams(params);
    merged.delete('person');
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };
  const step = (direction: 1 | -1) => {
    if (view === 'day') update({ date: addDays(date, direction) });
    else if (view === 'week') update({ date: addDays(date, 7 * direction) });
    else if (view === 'list') update({ date: addDays(date, LIST_DAYS * direction) });
    else {
      const [year, month] = date.split('-').map(Number) as [number, number];
      const target = new Date(Date.UTC(year, month - 1 + direction, 1));
      update({ date: target.toISOString().slice(0, 10) });
    }
  };
  const zoomBy = (by: 1 | -1) => {
    const index = ZOOMS.indexOf(zoom);
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (index < 0 ? 1 : index) + by))] ?? 1);
  };

  const allEvents = useMemo(
    () => (schedule.data ? buildEvents(schedule.data) : []),
    [schedule.data],
  );
  const needle = query.trim().toLowerCase();
  const events = allEvents.filter(
    (event) =>
      !hidden.includes(event.kind) &&
      (!needle ||
        [
          event.title,
          event.plan?.note,
          event.plan?.appointment?.companyName,
          event.plan?.owner.name,
        ]
          .filter(Boolean)
          .some((text) => (text ?? '').toLowerCase().includes(needle))),
  );
  const allPeople = schedule.data?.people ?? [];
  const order = allPeople.map((person) => person.id);
  const picked = chosen.length ? allPeople.filter((p) => chosen.includes(p.id)) : allPeople;
  // Sort by free time or appointments in the shown range, so a big team still reads well.
  const rangeDays = Array.from(
    { length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 },
    (_, index) => addDays(from, index),
  ).filter((day) => !isWeekend(day));
  const scoreOf = (id: string) =>
    sort === 'free'
      ? -rangeDays.reduce((sum, day) => sum + freeMinutes(eventsOn(allEvents, day, id), day), 0)
      : -allEvents.filter(
          (event) =>
            event.personId === id &&
            (event.kind === 'appointment' || event.kind === 'salesAppointment') &&
            event.startsAt.slice(0, 10) >= from &&
            event.startsAt.slice(0, 10) <= addDays(to, 1),
        ).length;
  const people =
    sort === 'name' ? picked : [...picked].sort((a, b) => scoreOf(a.id) - scoreOf(b.id));
  const shownIds = new Set(people.map((person) => person.id));
  // Ten people per page in the day and week views, so the grid fits on screen.
  const pages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = people.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const memberMenu = (paging: boolean) => (
    <MemberMenu
      people={allPeople}
      chosen={chosen}
      meId={user.id}
      onChange={setChosen}
      groups={groups}
      onGroups={setGroups}
      shown={people.length}
      page={currentPage}
      onPage={setPage}
      paging={paging}
    />
  );
  const setChosen = (ids: string[]) =>
    update({ people: ids.length === 0 || ids.length === allPeople.length ? '' : ids.join(',') });
  const holidays = schedule.data?.holidays ?? [];

  // Keyboard shortcuts, as in Google Calendar (not while typing or with a dialog open).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        target.closest('input, textarea, [contenteditable="true"], dialog[open], [role="dialog"]')
      )
        return;
      if (document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      const actions: Record<string, () => void> = {
        t: () => update({ date: todayJst() }),
        arrowleft: () => step(-1),
        arrowright: () => step(1),
        j: () => step(1),
        k: () => step(-1),
        d: () => update({ view: 'day' }),
        w: () => update({ view: 'week' }),
        m: () => update({ view: 'month' }),
        l: () => update({ view: 'list' }),
        f: () => setShowFree(!showFree),
        '/': () => search.current?.focus(),
        '+': () => zoomBy(1),
        '=': () => zoomBy(1),
        '-': () => zoomBy(-1),
        '?': () => setHelp(true),
        n: () =>
          canWritePlans && setPlanDialog({ defaults: { ownerId: chosen[0] ?? user.id, date } }),
      };
      const action = actions[key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title =
    view === 'day'
      ? `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日（${weekdayJa(date)}）`
      : view === 'month'
        ? `${Number(date.slice(5, 7))}月`
        : `${Number(from.slice(5, 7))}月${Number(from.slice(8))}日 – ${from.slice(5, 7) === to.slice(5, 7) ? '' : `${Number(to.slice(5, 7))}月`}${Number(to.slice(8))}日`;
  const year = date.slice(0, 4);

  // Busy share of office hours per day for the mini month's little bars.
  const load = (day: string) => {
    if (isWeekend(day) || people.length === 0) return 0;
    const span = (WORK_END - WORK_START) * people.length;
    const busy = people.reduce(
      (sum, person) =>
        sum +
        busyRanges(eventsOn(allEvents, day, person.id), day).reduce(
          (acc, [a, b]) => acc + Math.max(0, Math.min(b, WORK_END) - Math.max(a, WORK_START)),
          0,
        ),
      0,
    );
    return busy / span;
  };

  const counts = (kind: EventKind) =>
    allEvents.filter(
      (event) =>
        event.kind === kind &&
        shownIds.has(event.personId) &&
        event.startsAt.slice(0, 10) <= addDays(to, 1) &&
        event.endsAt.slice(0, 10) >= from,
    ).length;

  const nowMinutes = now.minutes;
  const upNext = eventsOn(allEvents, now.date, user.id)
    .filter((event) => !event.allDay && minutesWithin(event.endsAt, now.date, 'end') > nowMinutes)
    .slice(0, 3);

  const openRange = (ownerId: string, day: string, start: string, end: string) =>
    setPlanDialog({ defaults: { ownerId, date: day, time: start, endTime: end } });

  const bookingLink =
    'inline-flex h-10 items-center gap-2 border border-line-strong bg-surface px-3.5 text-sm font-bold text-ink transition-colors hover:border-main-line hover:bg-main-soft';

  return (
    <div ref={pageRef} className="schedule-page">
      {/* Page head: the place and the actions people come here for. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-sub">{ja.module.schedule}</p>
          <h1 className="text-2xl font-bold tracking-tight tabular-nums">
            {title}
            <span className="ml-2 text-base font-medium text-ink-sub">{year}年</span>
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canTimeOff && (
            <Button
              variant="secondary"
              icon={<CalendarOff className="size-4" aria-hidden="true" />}
              onClick={() => setTimeOffDialog({ userId: chosen[0] ?? user.id, date })}
            >
              休みを入力
            </Button>
          )}
          {canTelemaBook && (
            <Link to={existingListBookingHref(date, chosen[0])} className={bookingLink}>
              <FileUp className="size-4" aria-hidden="true" />
              既存リストのアポを登録
            </Link>
          )}
          {canSalesBook && (
            <Link
              to={`${paths.book}?source=SALES_BOOKED&repId=${user.id}&date=${date}`}
              className={bookingLink}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              自分で取ったアポを登録
            </Link>
          )}
          {canWritePlans && (
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setPlanDialog({ defaults: { ownerId: chosen[0] ?? user.id, date } })}
            >
              予定を追加
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-canvas/90 px-1 py-1.5 backdrop-blur-sm">
        <button
          type="button"
          aria-label={railOpen ? 'サイドを閉じる' : 'サイドを開く'}
          aria-pressed={railOpen}
          onClick={() => setRailOpen(!railOpen)}
          className="hidden size-10 cursor-pointer items-center justify-center border border-line-strong bg-surface text-ink-sub hover:text-ink lg:flex"
        >
          <PanelLeft aria-hidden="true" className="size-4" />
        </button>
        <div className="flex items-center border border-line-strong bg-surface">
          <button
            type="button"
            aria-label="前へ"
            onClick={() => step(-1)}
            className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => update({ date: todayJst() })}
            className="h-10 cursor-pointer border-x border-line px-4 text-sm font-bold hover:bg-column"
          >
            今日
          </button>
          <button
            type="button"
            aria-label="次へ"
            onClick={() => step(1)}
            className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:bg-column hover:text-ink"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <Segmented
          aria-label="表示"
          value={view}
          onChange={(value) => update({ view: value })}
          options={VIEWS}
        />
        {fullScreen.supported && (
          <Button
            variant="secondary"
            icon={
              fullScreen.on ? (
                <Minimize2 className="size-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-4" aria-hidden="true" />
              )
            }
            onClick={fullScreen.toggle}
          >
            {fullScreen.on ? '全画面を終了' : '全画面'}
          </Button>
        )}
        <div className="relative min-w-44 flex-1 sm:max-w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-sub"
          />
          <input
            ref={search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                event.currentTarget.blur();
              }
            }}
            placeholder="会社名・予定を検索"
            aria-label="会社名・予定を検索"
            className="h-10 w-full border border-line-strong bg-surface pr-8 pl-9 text-sm placeholder:text-ink-disabled focus:border-main-focus focus:ring-3 focus:ring-main-focus/20 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              aria-label="検索を消す"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : (
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 border border-line px-1.5 text-[10px] text-ink-sub max-sm:hidden">
              /
            </kbd>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(view === 'week' || view === 'day') && people.length > 1 && (
            <Select
              aria-label="並び順"
              size="sm"
              className="w-36"
              value={sort}
              options={[
                { value: 'name', label: '並び：名前順' },
                { value: 'free', label: '並び：空きが多い順' },
                { value: 'busy', label: '並び：アポが多い順' },
              ]}
              onChange={(e) => setSort(e.target.value as 'name' | 'free' | 'busy')}
            />
          )}
          <button
            type="button"
            aria-pressed={showFree}
            onClick={() => setShowFree(!showFree)}
            title="空き時間を表示（F）"
            className={cn(
              'inline-flex h-10 cursor-pointer items-center gap-1.5 border px-3 text-sm font-bold transition-colors',
              showFree
                ? 'border-free-ink/40 bg-free text-free-ink'
                : 'border-line-strong bg-surface text-ink-sub hover:text-ink',
            )}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            空き時間
          </button>
          {(view === 'day' || (view === 'week' && people.length === 1)) && (
            <div
              className="flex items-center border border-line-strong bg-surface"
              title="時間の幅（+ / −）"
            >
              <button
                type="button"
                aria-label="時間の幅を狭める"
                onClick={() => zoomBy(-1)}
                disabled={zoom <= (ZOOMS[0] ?? 0)}
                className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:text-ink disabled:opacity-30"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="時間の幅を広げる"
                onClick={() => zoomBy(1)}
                disabled={zoom >= (ZOOMS[ZOOMS.length - 1] ?? 9)}
                className="flex size-10 cursor-pointer items-center justify-center border-l border-line text-ink-sub hover:text-ink disabled:opacity-30"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="ショートカット一覧"
            onClick={() => setHelp(true)}
            className="hidden size-10 cursor-pointer items-center justify-center border border-line-strong bg-surface text-ink-sub hover:text-ink md:flex"
          >
            <Keyboard aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div className={cn('grid gap-4', railOpen && 'lg:grid-cols-[15.5rem_minmax(0,1fr)]')}>
        {/* Side rail */}
        <aside
          className={cn('hidden flex-col gap-5', railOpen && 'lg:flex')}
          aria-label="カレンダーの絞り込み"
        >
          <div className="border border-line bg-surface p-3">
            <MiniMonth
              date={date}
              range={{
                from: view === 'month' ? monthRange(date).from : from,
                to: view === 'month' ? monthRange(date).to : to,
              }}
              holidays={holidays}
              load={load}
              onPick={(day) => update({ date: day })}
            />
          </div>

          {upNext.length > 0 && (
            <section className="border border-line bg-surface">
              <h2 className="border-b border-line px-3 py-2 text-xs font-bold text-ink-sub">
                このあと（自分）
              </h2>
              <ul>
                {upNext.map((event) => {
                  const start = jstMinutesOfDay(new Date(event.startsAt));
                  const inProgress = start <= nowMinutes;
                  return (
                    <li key={event.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(event)}
                        className="flex w-full cursor-pointer gap-2 px-3 py-2 text-left hover:bg-hover"
                      >
                        <span className={cn('w-[3px] shrink-0', EVENT_STYLE[event.kind].bar)} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{event.title}</span>
                          <span className="text-[11px] text-ink-sub tabular-nums">
                            {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
                            <span
                              className={cn(
                                'ml-1.5 font-bold',
                                inProgress ? 'text-now' : 'text-calls',
                              )}
                            >
                              {inProgress ? '進行中' : `あと${hoursLabel(start - nowMinutes)}`}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-1.5 px-1 text-xs font-bold text-ink-sub">表示する種類</h2>
            <ul className="flex flex-col">
              {KINDS.map((kind) => {
                const on = !hidden.includes(kind);
                const count = counts(kind);
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setHidden(on ? [...hidden, kind] : hidden.filter((k) => k !== kind))
                      }
                      className={cn(
                        'flex min-h-8 w-full cursor-pointer items-center gap-2 px-1 text-left text-sm hover:bg-column',
                        !on && 'text-ink-disabled line-through',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-3 shrink-0',
                          EVENT_STYLE[kind].dot,
                          !on && 'opacity-30',
                        )}
                      />
                      <span className="flex-1">{EVENT_STYLE[kind].label}</span>
                      {count > 0 && (
                        <span className="text-[11px] text-ink-sub tabular-nums">{count}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex items-center gap-2 px-1 text-[11px] text-ink-sub">
              <span
                className="inline-block size-3 bg-weekend ring-1 ring-line"
                aria-hidden="true"
              />
              土日祝・会社の休日
            </p>
            <p className="mt-1 flex items-center gap-2 px-1 text-[11px] text-ink-sub">
              <span
                aria-hidden="true"
                className="inline-block size-3 ring-1 ring-line [background-image:repeating-linear-gradient(135deg,rgb(46_111_102/0.3)_0_2px,transparent_2px_5px)]"
              />
              移動時間（アポの前後{schedule.data?.travelBufferMinutes ?? 0}分）
            </p>
          </section>
        </aside>

        <div className="min-w-0">
          {!(view === 'week' && visible.length > 1) &&
            !(view === 'day' && visible.length > DAY_COLUMNS_MAX) && (
              <div className="mb-2 w-64">{memberMenu(view === 'day' || view === 'week')}</div>
            )}

          <QueryState query={schedule}>
            {(data) => {
              if (people.length === 0) {
                return (
                  <p className="border border-line bg-surface py-16 text-center text-sm text-ink-sub">
                    メンバーを1人以上選んでください。
                  </p>
                );
              }
              if (view === 'day' && visible.length > DAY_COLUMNS_MAX) {
                const holiday = data.holidays.find((h) => h.date === date);
                return (
                  <DayTimeline
                    corner={memberMenu(true)}
                    date={date}
                    people={visible}
                    events={events}
                    off={isWeekend(date) || Boolean(holiday)}
                    onEvent={setSelected}
                    peek={peek.bind}
                    showFree={showFree}
                    pxPerMin={zoom}
                    colorOrder={order}
                    onRange={
                      canWritePlans
                        ? (ownerId, start, end) => openRange(ownerId, date, start, end)
                        : undefined
                    }
                  />
                );
              }
              if (view === 'day') {
                return (
                  <DayView
                    date={date}
                    people={visible}
                    events={events}
                    holidays={data.holidays}
                    onEvent={setSelected}
                    peek={peek.bind}
                    showFree={showFree}
                    bufferMinutes={data.travelBufferMinutes}
                    pxPerMin={zoom}
                    colorOrder={order}
                    onRange={
                      canWritePlans
                        ? (ownerId, start, end) => openRange(ownerId, date, start, end)
                        : undefined
                    }
                  />
                );
              }
              if (view === 'week' && people.length === 1) {
                const person = people[0] ?? allPeople[0];
                if (!person) return null;
                const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
                return (
                  <TimeGrid
                    pxPerMin={zoom}
                    onEvent={setSelected}
                    peek={peek.bind}
                    showFree={showFree}
                    bufferMinutes={data.travelBufferMinutes}
                    minColumnWidth={120}
                    columnLabel={(column) => `${column.date}の空き時間を選ぶ`}
                    onRange={
                      canWritePlans
                        ? (column, start, end) => openRange(person.id, column.date, start, end)
                        : undefined
                    }
                    columns={days.map((day) => {
                      const holiday = data.holidays.find((h) => h.date === day);
                      return {
                        key: day,
                        date: day,
                        personId: person.id,
                        off: isWeekend(day) || Boolean(holiday),
                        events: eventsOn(events, day, person.id),
                        header: (
                          <button
                            type="button"
                            onClick={() => update({ view: 'day', date: day })}
                            className="flex w-full cursor-pointer items-end gap-1.5 text-left"
                          >
                            <span
                              className={cn(
                                'flex h-8 min-w-8 items-center justify-center px-1 text-xl leading-none font-bold tabular-nums',
                                day === todayJst() ? 'bg-main text-white' : 'hover:bg-column',
                              )}
                            >
                              {Number(day.slice(8))}
                            </span>
                            <span className="min-w-0 pb-0.5 text-[11px] text-ink-sub">
                              {weekdayJa(day)}
                              {holiday && (
                                <span className="ml-1 truncate text-sunday">{holiday.name}</span>
                              )}
                            </span>
                          </button>
                        ),
                      };
                    })}
                  />
                );
              }
              if (view === 'week') {
                return (
                  <WeekView
                    corner={memberMenu(true)}
                    start={from}
                    people={visible}
                    events={events}
                    holidays={data.holidays}
                    onEvent={setSelected}
                    peek={peek.bind}
                    showFree={showFree}
                    colorOrder={order}
                    onDay={(_personId, day) => update({ view: 'day', date: day })}
                    onAdd={
                      canWritePlans
                        ? (ownerId, day) => setPlanDialog({ defaults: { ownerId, date: day } })
                        : undefined
                    }
                  />
                );
              }
              if (view === 'list') {
                return (
                  <AgendaView
                    from={from}
                    days={LIST_DAYS}
                    people={people}
                    events={events}
                    holidays={data.holidays}
                    onEvent={setSelected}
                    peek={peek.bind}
                    colorOrder={order}
                  />
                );
              }
              return (
                <MonthView
                  month={date}
                  people={people}
                  events={events}
                  holidays={data.holidays}
                  onEvent={setSelected}
                  peek={peek.bind}
                  colorOrder={order}
                  onDay={(day) => update({ view: 'day', date: day })}
                />
              );
            }}
          </QueryState>
          {view !== 'list' && view !== 'month' && canWritePlans && (
            <p className="mt-2 text-xs text-ink-sub">
              {view === 'week' && people.length > 1
                ? 'マスにカーソルを合わせると「＋」で予定を追加できます。1人だけ選ぶと時間の表示になります。'
                : '空いている時間をドラッグすると、その時間で予定を追加できます。'}
            </p>
          )}
        </div>
      </div>

      {peek.layer}
      <EventDetailDialog
        event={selected}
        onClose={() => setSelected(null)}
        onEdit={(event) => {
          setSelected(null);
          setPlanDialog({ event });
        }}
      />
      {planDialog && (
        <PlanDialog
          open
          plan={planDialog.event?.plan}
          defaults={planDialog.defaults}
          onClose={() => setPlanDialog(null)}
        />
      )}
      {timeOffDialog && (
        <TimeOffDialog open defaults={timeOffDialog} onClose={() => setTimeOffDialog(null)} />
      )}
      <Dialog open={help} onClose={() => setHelp(false)} title="キーボードショートカット">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="border border-line-strong bg-column px-2 py-0.5 text-xs font-bold">
                  {key}
                </kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}

/** 「全画面」 (request 10/29): the calendar alone on the whole screen; Esc returns. */
function useFullScreen(target: RefObject<HTMLDivElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.fullscreenElement === target.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [target]);
  return {
    supported: typeof document !== 'undefined' && Boolean(document.fullscreenEnabled),
    on,
    toggle: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void target.current?.requestFullscreen?.();
    },
  };
}
