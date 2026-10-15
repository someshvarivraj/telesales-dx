/**
 * Auto allocation (spec §7, priority 2). Pure rules, no database:
 *
 *   - Only telemarketers working that day who are allocation targets take part.
 *   - Share = own working minutes ÷ everyone's working minutes. Workload is not considered.
 *   - Whole items are handed out by share; remainders go one each to the largest fractions.
 *   - Companies with the same name stay with the same person.
 *   - A day-before check goes to the person who booked it when they are working;
 *     the rest are shared out the same way as call lists.
 */
export interface AllocationTarget {
  userId: string;
  workingMinutes: number;
}

export interface CallItem {
  id: string;
  /** Companies with the same key (normalised name) go to the same person. */
  groupKey: string;
}

export interface DayBeforeItem {
  id: string;
  bookedById: string;
}

export class Allocator {
  private readonly targets: AllocationTarget[];

  constructor(targets: readonly AllocationTarget[]) {
    this.targets = targets.filter((target) => target.workingMinutes > 0);
  }

  get totalMinutes(): number {
    return this.targets.reduce((sum, target) => sum + target.workingMinutes, 0);
  }

  shareOf(userId: string): number {
    const total = this.totalMinutes;
    const target = this.targets.find((t) => t.userId === userId);
    return total > 0 && target ? target.workingMinutes / total : 0;
  }

  /**
   * How many of `count` items each person gets: floor of the exact share, then the
   * remainder one each to the largest fractions (ties: the order of the targets).
   */
  quotas(count: number): Map<string, number> {
    const total = this.totalMinutes;
    const result = new Map<string, number>();
    if (total === 0) {
      return result;
    }
    const exact = this.targets.map((target, index) => {
      const value = (count * target.workingMinutes) / total;
      return { userId: target.userId, index, whole: Math.floor(value), fraction: value % 1 };
    });
    exact.forEach((entry) => result.set(entry.userId, entry.whole));
    let left = count - exact.reduce((sum, entry) => sum + entry.whole, 0);
    const byFraction = [...exact].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    for (const entry of byFraction) {
      if (left <= 0) {
        break;
      }
      result.set(entry.userId, (result.get(entry.userId) ?? 0) + 1);
      left -= 1;
    }
    return result;
  }

  /** Item id → assignee. Same-name groups are kept whole and go to whoever has most room. */
  allocateCalls(items: readonly CallItem[]): Map<string, string> {
    const assignment = new Map<string, string>();
    if (this.targets.length === 0 || items.length === 0) {
      return assignment;
    }
    const room = this.quotas(items.length);
    const groups = new Map<string, string[]>();
    for (const item of items) {
      groups.set(item.groupKey, [...(groups.get(item.groupKey) ?? []), item.id]);
    }
    for (const ids of groups.values()) {
      const userId = this.mostRoom(room);
      ids.forEach((id) => assignment.set(id, userId));
      room.set(userId, (room.get(userId) ?? 0) - ids.length);
    }
    return assignment;
  }

  /**
   * Item id → assignee. `working` is everyone with a working shift that day (a booker
   * who is working keeps their own checks even if they are not an allocation target).
   */
  allocateDayBefore(
    items: readonly DayBeforeItem[],
    working: ReadonlySet<string>,
  ): Map<string, string> {
    const assignment = new Map<string, string>();
    const rest: CallItem[] = [];
    for (const item of items) {
      if (working.has(item.bookedById)) {
        assignment.set(item.id, item.bookedById);
      } else {
        rest.push({ id: item.id, groupKey: item.id });
      }
    }
    for (const [id, userId] of this.allocateCalls(rest)) {
      assignment.set(id, userId);
    }
    return assignment;
  }

  private mostRoom(room: Map<string, number>): string {
    let best = this.targets[0]?.userId ?? '';
    let bestRoom = Number.NEGATIVE_INFINITY;
    for (const target of this.targets) {
      const left = room.get(target.userId) ?? 0;
      if (left > bestRoom) {
        best = target.userId;
        bestRoom = left;
      }
    }
    return best;
  }
}

/** Scheduled hours minus break, in minutes (never negative). */
export function workingMinutesOf(start: string, end: string, breakMinutes: number): number {
  const toMinutes = (time: string) => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return Math.max(0, toMinutes(end) - toMinutes(start) - breakMinutes);
}
