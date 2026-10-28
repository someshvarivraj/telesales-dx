import type { PrismaClient } from '../../generated/prisma/client.js';

interface Named {
  id: string;
  name: string;
}

/** What a tool returns when a name matched nobody or more than one. */
export type LookupError =
  | { error: 'person_not_found' | 'company_not_found'; name: string }
  | { error: 'several_match'; candidates: string[] };

const SELF = ['自分', '私', 'わたし', 'me'];
const strip = (text: string) => text.replace(/\s|さん|様|株式会社|（株）|\(株\)/g, '');

function single<T extends Named>(
  rows: T[],
  name: string,
  notFound: 'person_not_found' | 'company_not_found',
): T | LookupError {
  const [only] = rows;
  if (rows.length === 1 && only) return only;
  return rows.length === 0
    ? { error: notFound, name }
    : { error: 'several_match', candidates: rows.map((row) => row.name).slice(0, 10) };
}

/** Active users whose name contains the text (spaces ignored); 「自分」 = the signed-in user. */
export async function findPeople(
  prisma: PrismaClient,
  actorId: string,
  person: string,
): Promise<Named[]> {
  if (SELF.includes(person.trim())) {
    const me = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true },
    });
    return me ? [me] : [];
  }
  const needle = strip(person);
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  return users.filter((user) => strip(user.name).includes(needle));
}

export async function findPerson(
  prisma: PrismaClient,
  actorId: string,
  person: string,
): Promise<Named | LookupError> {
  return single(await findPeople(prisma, actorId, person), person, 'person_not_found');
}

/** One company by (part of) its name; an exact name wins over partial matches. */
export async function findCompany(
  prisma: PrismaClient,
  name: string,
): Promise<Named | LookupError> {
  const needle = strip(name);
  if (!needle) return { error: 'company_not_found', name };
  const rows = await prisma.company.findMany({
    where: { name: { contains: needle, mode: 'insensitive' } },
    select: { id: true, name: true, office: true },
    orderBy: { name: 'asc' },
    take: 11,
  });
  const exact = rows.filter((row) => strip(row.name) === needle);
  const named = (exact.length > 0 ? exact : rows).map((row) => ({
    id: row.id,
    name: row.office ? `${row.name}（${row.office}）` : row.name,
  }));
  return single(named, name, 'company_not_found');
}

export const isLookupError = (value: unknown): value is LookupError =>
  typeof value === 'object' && value !== null && 'error' in value;
