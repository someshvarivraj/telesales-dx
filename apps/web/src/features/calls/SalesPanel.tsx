import {
  addDays,
  AppointmentSource,
  dayOfWeek,
  isWeekend,
  Permission,
  Role,
  weekdayJa,
} from '@telesales/shared';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Maximize2,
  Minimize2,
  Minus,
  PictureInPicture2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { cn } from '@/components/ui/cn';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useFindRep } from '@/features/calls/api';
import { usePeople } from '@/features/reference/useReference';
import { useSchedule } from '@/features/schedule/api';
import { DayTimeline } from '@/features/schedule/calendar/DayTimeline';
import { TimeGrid } from '@/features/schedule/calendar/TimeGrid';
import { buildEvents, eventsOn, isDayOff } from '@/features/schedule/events';
import { formatShortDate, todayJst } from '@/lib/format';
import { isSalesOnly } from '@/components/layout/navItems';

/**
 * 営業の予定 beside the call list (request 11/17): テレマ call while looking at the sales reps'
 * calendars and the company on one screen. Opened for a company, it suggests the 担当営業 from the
 * area table and shows that rep's week; dragging over a free stretch holds it and opens the booking.
 * It can sit as a small bar, float in the corner, share the screen (split) or fill it.
 */
export type PanelMode = 'closed' | 'min' | 'float' | 'split' | 'max';

interface PanelCompany {
  id: string;
  name: string;
  /** The latest A call record, so the booking is tied to it. */
  callRecordId?: string | null;
}

interface PanelContext {
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;
  company: PanelCompany | null;
  /** Show the panel for this company (suggests its rep). */
  openFor: (company: PanelCompany) => void;
}

const Ctx = createContext<PanelContext | null>(null);
const STORE = 'sales-panel-mode';

function storedMode(): PanelMode | null {
  try {
    const value = window.localStorage.getItem(STORE);
    return value === 'min' || value === 'float' || value === 'split' || value === 'max'
      ? value
      : value === 'closed'
        ? 'closed'
        : null;
  } catch {
    return null;
  }
}

export function useSalesPanel() {
  return useContext(Ctx);
}

/** Where the panel is offered: the call list and the company pages. */
export function onCallsScreen(pathname: string) {
  return pathname === paths.calls || pathname.startsWith('/calls/companies/');
}

export function SalesPanelProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const canBook = usePermission(Permission.ManageTelemaAppointments);
  // A plain テレマ gets the call list and the sales schedule as one screen by default (item 14).
  const plainTelema = user.roles.length > 0 && user.roles.every((role) => role === Role.Telema);
  const [mode, setModeState] = useState<PanelMode>(
    () => storedMode() ?? (plainTelema ? 'split' : 'min'),
  );
  const [company, setCompany] = useState<PanelCompany | null>(null);
  const setMode = useCallback((next: PanelMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORE, next);
    } catch {
      // Private windows: the choice just isn't remembered.
    }
  }, []);
  const openFor = useCallback((next: PanelCompany) => {
    setCompany(next);
    setModeState((current) => (current === 'split' || current === 'max' ? current : 'float'));
  }, []);
  const value = useMemo(
    () => ({
      mode: canBook && !isSalesOnly(user.roles) ? mode : 'closed',
      setMode,
      company,
      openFor,
    }),
    [canBook, user.roles, mode, setMode, company, openFor],
  );
  return <Ctx.Provider value={value as PanelContext}>{children}</Ctx.Provider>;
}

/** Room the docked panel takes from the page on wide screens. */
export const SPLIT_WIDTH = 'min(46vw, 760px)';

function mondayOf(date: string) {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function SalesPanel() {
  const panel = useSalesPanel();
  const { pathname } = useLocation();
  if (!panel || panel.mode === 'closed' || !onCallsScreen(pathname)) return null;
  return <PanelBody panel={panel} />;
}

function PanelBody({ panel }: { panel: PanelContext }) {
  const { mode, setMode, company } = panel;
  const navigate = useNavigate();
  const reps = usePeople(Role.Sales);
  const find = useFindRep();
  const [repId, setRepId] = useState<string>('');
  const [date, setDate] = useState(todayJst);

  // A new company: ask the area table who its rep is, and show that person.
  const { mutate } = find;
  useEffect(() => {
    if (!company) return;
    mutate(
      { companyId: company.id },
      { onSuccess: (suggestion) => suggestion.rep && setRepId(suggestion.rep.id) },
    );
  }, [company, mutate]);

  const monday = mondayOf(date);
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const from = repId ? monday : date;
  const to = repId ? addDays(monday, 4) : date;
  const schedule = useSchedule(from, to, []);
  const events = useMemo(() => (schedule.data ? buildEvents(schedule.data) : []), [schedule.data]);
  const people = reps.data ?? [];
  const order = people.map((person) => person.id);
  const rep = people.find((person) => person.id === repId);
  const suggestion = find.data;

  const book = (day: string, start: string, end: string) => {
    if (!repId) return;
    const params = new URLSearchParams({
      repId,
      date: day,
      start,
      end,
      hold: '1',
      ...(company
        ? {
            source: AppointmentSource.CallStatus,
            companyId: company.id,
            ...(company.callRecordId ? { callRecordId: company.callRecordId } : {}),
          }
        : { source: AppointmentSource.File }),
      ...(suggestion?.webOnly ? { format: 'ONLINE' } : {}),
    });
    navigate(`${paths.book}?${params.toString()}`);
  };

  if (mode === 'min') {
    return (
      <button
        type="button"
        onClick={() => setMode('float')}
        className="fixed right-24 bottom-6 z-40 flex cursor-pointer items-center gap-2 border border-main-line bg-surface px-3 py-2 text-sm font-bold text-ink shadow-(--shadow-raised) hover:bg-main-soft max-md:hidden"
      >
        <CalendarDays aria-hidden="true" className="size-4 text-main" />
        営業の予定
        {company && (
          <span className="max-w-40 truncate font-normal text-ink-sub">{company.name}</span>
        )}
      </button>
    );
  }

  const shell = {
    float:
      'right-24 bottom-6 h-[min(560px,calc(100dvh-6rem))] w-[min(620px,calc(100vw-8rem))] border border-line',
    split: 'top-11 right-0 bottom-0 border-l border-line',
    max: 'top-11 right-0 bottom-0 left-(--sidebar-w)',
  }[mode as 'float' | 'split' | 'max'];
  const stepDays = repId ? 7 : 1;

  return (
    <section
      aria-label="営業の予定"
      style={mode === 'split' ? { width: SPLIT_WIDTH } : undefined}
      className={cn(
        'sales-panel fixed z-30 flex flex-col bg-surface shadow-(--shadow-raised) max-md:hidden',
        shell,
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-column px-3">
        <CalendarDays aria-hidden="true" className="size-4 text-main" />
        <h2 className="text-sm font-bold">営業の予定</h2>
        {company && (
          <span className="min-w-0 truncate text-xs text-ink-sub" title={company.name}>
            ・{company.name}
          </span>
        )}
        <div className="ml-auto flex items-center">
          <ModeButton label="小さくする" onClick={() => setMode('min')} icon={Minus} />
          <ModeButton
            label="小窓で表示"
            active={mode === 'float'}
            onClick={() => setMode('float')}
            icon={PictureInPicture2}
          />
          <ModeButton
            label="画面を分けて表示"
            active={mode === 'split'}
            onClick={() => setMode('split')}
            icon={Columns2}
          />
          <ModeButton
            label={mode === 'max' ? '元に戻す' : '大きく表示'}
            active={mode === 'max'}
            onClick={() => setMode(mode === 'max' ? 'split' : 'max')}
            icon={mode === 'max' ? Minimize2 : Maximize2}
          />
          <ModeButton label="閉じる" onClick={() => setMode('min')} icon={X} />
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <select
          aria-label="表示する営業"
          value={repId}
          onChange={(event) => setRepId(event.target.value)}
          className="h-8 min-w-40 border border-line-strong bg-surface px-2 text-sm"
        >
          <option value="">営業全員（1日）</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {suggestion?.rep?.id === person.id ? '（担当表）' : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center">
          <ModeButton
            label={repId ? '前の週' : '前の日'}
            onClick={() => setDate(addDays(date, -stepDays))}
            icon={ChevronLeft}
          />
          <button
            type="button"
            onClick={() => setDate(todayJst())}
            className="h-8 cursor-pointer border border-line px-2 text-xs font-bold hover:bg-hover"
          >
            今日
          </button>
          <ModeButton
            label={repId ? '次の週' : '次の日'}
            onClick={() => setDate(addDays(date, stepDays))}
            icon={ChevronRight}
          />
        </div>
        <span className="text-sm font-bold tabular-nums">
          {repId
            ? `${formatShortDate(monday)} – ${formatShortDate(addDays(monday, 4))}`
            : `${formatShortDate(date)}（${weekdayJa(date)}）`}
        </span>
      </div>

      {company && suggestion && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-main-soft/60 px-3 py-1.5 text-xs">
          <Sparkles aria-hidden="true" className="size-3.5 text-main" />
          {suggestion.rep ? (
            <>
              営業担当表では <b>{suggestion.rep.name}</b> さん（{suggestion.matchedBy}）
              {suggestion.backup && (
                <button
                  type="button"
                  onClick={() => suggestion.backup && setRepId(suggestion.backup.id)}
                  className="cursor-pointer text-link hover:underline"
                >
                  代わり：{suggestion.backup.name}
                </button>
              )}
              {suggestion.webOnly && <span className="font-bold">Webのみ</span>}
            </>
          ) : (
            '営業担当表に合う行がありません。営業を選んでください。'
          )}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-hidden p-2">
        {repId && rep ? (
          <TimeGrid
            maxHeight="100%"
            minColumnWidth={mode === 'float' ? 90 : 110}
            onEvent={() => undefined}
            columnLabel={(column) => `${column.date}の空き時間を選ぶ`}
            onRange={(column, start, end) => book(column.date, start, end)}
            bufferMinutes={schedule.data?.travelBufferMinutes}
            showFree
            columns={days.map((day) => {
              const holiday = schedule.data?.holidays.find((h) => h.date === day);
              const dayEvents = eventsOn(events, day, rep.id);
              const off = isWeekend(day) || Boolean(holiday);
              return {
                key: day,
                date: day,
                personId: rep.id,
                off,
                dayOff: !off && isDayOff(dayEvents),
                events: dayEvents,
                header: (
                  <span className="flex items-end gap-1.5">
                    <span
                      className={cn(
                        'flex h-7 min-w-7 items-center justify-center px-1 text-lg leading-none font-bold tabular-nums',
                        day === todayJst() && 'bg-main text-white',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span className="pb-0.5 text-[11px] text-ink-sub">
                      {weekdayJa(day)}
                      {holiday && <span className="ml-1 text-sunday">{holiday.name}</span>}
                    </span>
                  </span>
                ),
              };
            })}
          />
        ) : (
          <DayTimeline
            maxHeight="100%"
            date={date}
            people={people}
            events={events}
            off={isWeekend(date)}
            onEvent={() => undefined}
            showFree
            colorOrder={order}
            onRange={(personId, start, end) => {
              setRepId(personId);
              const params = new URLSearchParams({ repId: personId, date, start, end, hold: '1' });
              if (company) {
                params.set('source', AppointmentSource.CallStatus);
                params.set('companyId', company.id);
                if (company.callRecordId) params.set('callRecordId', company.callRecordId);
              } else params.set('source', AppointmentSource.File);
              navigate(`${paths.book}?${params.toString()}`);
            }}
            corner={<span className="text-[11px] font-bold text-ink-sub">営業</span>}
          />
        )}
      </div>
      <p className="shrink-0 border-t border-line px-3 py-1.5 text-[11px] text-ink-sub">
        空いている時間をなぞると、その枠を押さえてアポ登録へ進みます。
      </p>
    </section>
  );
}

function ModeButton({
  label,
  onClick,
  icon: Icon,
  active = false,
}: {
  label: string;
  onClick: () => void;
  icon: typeof X;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center text-ink-sub hover:bg-hover hover:text-ink',
        active && 'bg-main-soft text-main',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
