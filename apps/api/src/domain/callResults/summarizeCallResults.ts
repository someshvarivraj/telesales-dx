import {
  addDays,
  CALL_RESULT_GRADES_COUNTED,
  type CallResultsCell,
  type CallResultsRow,
  jstDate,
  type UserRef,
} from '@telesales/shared';

export interface CountedCall {
  telemarketerId: string;
  calledAt: Date;
  grade: string;
}

export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/**
 * Counts each telemarketer's calls per JST day (answer 11/10 No.3). People are listed in the
 * order given, followed by anyone else who called in the period; E calls are not counted.
 */
export function summarizeCallResults(
  calls: readonly CountedCall[],
  dates: readonly string[],
  people: readonly UserRef[],
  others: ReadonlyMap<string, UserRef>,
): { rows: CallResultsRow[]; totals: CallResultsCell[] } {
  const index = new Map(dates.map((date, i) => [date, i]));
  const counts = new Map<string, { calls: number[]; appointments: number[] }>();
  const order = people.map((person) => person.id);
  const known = new Map(people.map((person) => [person.id, person]));

  for (const call of calls) {
    if (!CALL_RESULT_GRADES_COUNTED.includes(call.grade)) continue;
    const day = index.get(jstDate(call.calledAt));
    if (day === undefined) continue;
    let entry = counts.get(call.telemarketerId);
    if (!entry) {
      entry = { calls: dates.map(() => 0), appointments: dates.map(() => 0) };
      counts.set(call.telemarketerId, entry);
      if (!known.has(call.telemarketerId)) order.push(call.telemarketerId);
    }
    entry.calls[day] = (entry.calls[day] ?? 0) + 1;
    if (call.grade === 'A') entry.appointments[day] = (entry.appointments[day] ?? 0) + 1;
  }

  const rows: CallResultsRow[] = [];
  for (const id of order) {
    const person = known.get(id) ?? others.get(id);
    if (!person) continue;
    const entry = counts.get(id);
    const days = dates.map((date, i) => ({
      date,
      calls: entry?.calls[i] ?? 0,
      appointments: entry?.appointments[i] ?? 0,
    }));
    rows.push({
      telemarketer: person,
      days,
      calls: days.reduce((sum, day) => sum + day.calls, 0),
      appointments: days.reduce((sum, day) => sum + day.appointments, 0),
    });
  }
  const totals = dates.map((date, i) => ({
    date,
    calls: rows.reduce((sum, row) => sum + (row.days[i]?.calls ?? 0), 0),
    appointments: rows.reduce((sum, row) => sum + (row.days[i]?.appointments ?? 0), 0),
  }));
  return { rows, totals };
}
