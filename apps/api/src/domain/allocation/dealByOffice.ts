import { OFFICE_KINDS, type OfficeKind, officeKindOf } from '@telesales/shared';

export interface OfficeItem {
  id: string;
  office: string | null;
}

/**
 * 検索結果をまとめて割り振る (answer 11/10 No.5 ②): deals the companies to the people so that
 * 本社・支社・工場・その他 are each spread evenly, and everyone ends up with about the same total.
 * Within a kind the search order is kept; each company goes to whoever has the fewest of that
 * kind, then the fewest overall, then comes first in the list.
 */
export function dealByOffice(
  items: readonly OfficeItem[],
  assigneeIds: readonly string[],
): Map<string, string> {
  const assignment = new Map<string, string>();
  if (assigneeIds.length === 0) return assignment;
  const totals = new Map(assigneeIds.map((id) => [id, 0]));
  for (const kind of OFFICE_KINDS) {
    const ofKind = new Map(assigneeIds.map((id) => [id, 0]));
    for (const item of items) {
      if (officeKindOf(item.office) !== kind) continue;
      let best = assigneeIds[0] as string;
      for (const id of assigneeIds) {
        const fewer =
          (ofKind.get(id) ?? 0) - (ofKind.get(best) ?? 0) ||
          (totals.get(id) ?? 0) - (totals.get(best) ?? 0);
        if (fewer < 0) best = id;
      }
      assignment.set(item.id, best);
      ofKind.set(best, (ofKind.get(best) ?? 0) + 1);
      totals.set(best, (totals.get(best) ?? 0) + 1);
    }
  }
  return assignment;
}

export function countByKind(
  items: readonly OfficeItem[],
  assignment: ReadonlyMap<string, string>,
  userId: string,
): Record<OfficeKind, number> {
  const counts: Record<OfficeKind, number> = { HEAD: 0, BRANCH: 0, FACTORY: 0, OTHER: 0 };
  for (const item of items) {
    if (assignment.get(item.id) === userId) counts[officeKindOf(item.office)] += 1;
  }
  return counts;
}
