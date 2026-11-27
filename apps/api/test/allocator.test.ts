import { describe, expect, it } from 'vitest';
import { Allocator, workingMinutesOf } from '../src/domain/allocation/Allocator.js';

const countBy = (assignment: Map<string, string>) => {
  const counts = new Map<string, number>();
  assignment.forEach((userId) => counts.set(userId, (counts.get(userId) ?? 0) + 1));
  return counts;
};

describe('workingMinutesOf', () => {
  it('is scheduled hours minus break', () => {
    expect(workingMinutesOf('09:00', '18:00', 60)).toBe(480);
    expect(workingMinutesOf('10:00', '15:00', 0)).toBe(300);
  });

  it('never goes below zero', () => {
    expect(workingMinutesOf('09:00', '09:30', 60)).toBe(0);
  });
});

describe('Allocator.quotas', () => {
  it('splits by working hours and hands remainders to the largest fractions', () => {
    const allocator = new Allocator([
      { userId: 'full', workingMinutes: 480 },
      { userId: 'half', workingMinutes: 240 },
    ]);
    // 10 × 2/3 = 6.67, 10 × 1/3 = 3.33 → 6 + 1 and 3
    expect(Object.fromEntries(allocator.quotas(10))).toEqual({ full: 7, half: 3 });
  });

  it('always hands out exactly the number of items', () => {
    const allocator = new Allocator([
      { userId: 'a', workingMinutes: 420 },
      { userId: 'b', workingMinutes: 420 },
      { userId: 'c', workingMinutes: 420 },
    ]);
    const quotas = allocator.quotas(100);
    expect([...quotas.values()].reduce((sum, n) => sum + n, 0)).toBe(100);
    expect(quotas.get('a')).toBe(34);
  });

  it('leaves out people with no working time', () => {
    const allocator = new Allocator([
      { userId: 'a', workingMinutes: 480 },
      { userId: 'off', workingMinutes: 0 },
    ]);
    expect(allocator.shareOf('off')).toBe(0);
    expect(Object.fromEntries(allocator.quotas(5))).toEqual({ a: 5 });
  });
});

describe('Allocator.allocateCalls', () => {
  it('keeps companies with the same name with one person', () => {
    const allocator = new Allocator([
      { userId: 'a', workingMinutes: 480 },
      { userId: 'b', workingMinutes: 480 },
    ]);
    const assignment = allocator.allocateCalls([
      { id: '1', groupKey: 'moraboo' },
      { id: '2', groupKey: 'other' },
      { id: '3', groupKey: 'moraboo' },
      { id: '4', groupKey: 'third' },
    ]);
    expect(assignment.get('1')).toBe(assignment.get('3'));
    expect(countBy(assignment)).toEqual(
      new Map([
        ['a', 2],
        ['b', 2],
      ]),
    );
  });

  it('allocates nothing when nobody is working', () => {
    expect(new Allocator([]).allocateCalls([{ id: '1', groupKey: 'x' }]).size).toBe(0);
  });
});

describe('Allocator.allocateDayBefore', () => {
  it('gives a check to the booker when they are working, and shares out the rest', () => {
    const allocator = new Allocator([
      { userId: 'a', workingMinutes: 480 },
      { userId: 'b', workingMinutes: 480 },
    ]);
    const assignment = allocator.allocateDayBefore(
      [
        { id: 'own', bookedById: 'b' },
        { id: 'x', bookedById: 'absent' },
        { id: 'y', bookedById: 'absent' },
      ],
      new Set(['a', 'b']),
    );
    expect(assignment.get('own')).toBe('b');
    expect(new Set([assignment.get('x'), assignment.get('y')])).toEqual(new Set(['a', 'b']));
  });

  it('keeps a working booker even if they are not an allocation target', () => {
    const allocator = new Allocator([{ userId: 'a', workingMinutes: 480 }]);
    const assignment = allocator.allocateDayBefore(
      [{ id: 'own', bookedById: 'manager' }],
      new Set(['a', 'manager']),
    );
    expect(assignment.get('own')).toBe('manager');
  });
});

describe('Allocator.allocateCalls: 本社・支社・工場・その他 spread evenly (request 11/27)', () => {
  const people = [
    { userId: 'a', workingMinutes: 480 },
    { userId: 'b', workingMinutes: 480 },
  ];
  const kindsOf = (
    assignment: Map<string, string>,
    userId: string,
    items: { id: string; kind: string }[],
  ) =>
    items
      .filter((item) => assignment.get(item.id) === userId)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.kind] = (acc[item.kind] ?? 0) + 1;
        return acc;
      }, {});

  it('gives each person half of every kind, even when the list is sorted by kind', () => {
    // A list where the 本社 rows come first would otherwise go mostly to one person.
    const items = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `h${i}`, kind: 'HEAD' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `f${i}`, kind: 'FACTORY' as const })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, kind: 'BRANCH' as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `o${i}`, kind: 'OTHER' as const })),
    ];
    const assignment = new Allocator(people).allocateCalls(
      items.map((item) => ({ id: item.id, groupKey: item.id, kind: item.kind })),
    );
    expect(kindsOf(assignment, 'a', items)).toEqual({ HEAD: 2, FACTORY: 1, BRANCH: 3, OTHER: 1 });
    expect(kindsOf(assignment, 'b', items)).toEqual({ HEAD: 2, FACTORY: 1, BRANCH: 3, OTHER: 1 });
  });

  it('still follows working hours and keeps same-name companies together', () => {
    const items = [
      { id: 'x本社', groupKey: 'x', kind: 'HEAD' as const },
      { id: 'x工場', groupKey: 'x', kind: 'FACTORY' as const },
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `h${i}`,
        groupKey: `h${i}`,
        kind: 'HEAD' as const,
      })),
    ];
    const assignment = new Allocator([
      { userId: 'a', workingMinutes: 600 },
      { userId: 'b', workingMinutes: 200 },
    ]).allocateCalls(items);
    expect(assignment.get('x本社')).toBe(assignment.get('x工場'));
    expect(countBy(assignment)).toEqual(
      new Map([
        ['a', 6],
        ['b', 2],
      ]),
    );
  });
});
