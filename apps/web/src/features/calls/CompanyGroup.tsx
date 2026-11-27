import {
  type CompanyDetail,
  type CompanyListItem,
  type CompanyRefWithDepartment,
  type GroupAppointmentDto,
  jstDate,
  OptionCategory,
  Permission,
} from '@telesales/shared';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useOptionList } from '@/features/reference/useReference';
import { cn } from '@/components/ui/cn';
import { Table, Td, Th } from '@/components/ui/Table';
import { formatDate, formatTime } from '@/lib/format';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useCompanyGroup } from './api';
import { MapLinks } from '@/components/maps/MapLinks';

function place(company: { office: string | null; department: string | null }): string {
  return [company.office, company.department].filter(Boolean).join(' ') || '（事業所・部署なし）';
}

/**
 * 同じ会社の部署・事業所 (request 11/2): same-name companies with another department or office
 * are kept apart (own phone, own calls) but grouped, and shown together here. Ticking the
 * same-name ones below groups them with this company.
 */
export function CompanyGroupCard({ company }: { company: CompanyDetail }) {
  const canEditCompanies = usePermission(Permission.EditCompanies);
  const canResolve = usePermission(Permission.ResolveDuplicates);
  const canEdit = canEditCompanies || canResolve;
  const { group, ungroup } = useCompanyGroup(company.id);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const members = company.groupMembers;
  const candidates = company.sameNameCompanies;
  if (members.length === 0 && candidates.length === 0) return null;
  const error = group.error ?? ungroup.error;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Building2 className="size-5 text-ink-sub" aria-hidden="true" />
          同じ会社の部署・事業所
        </span>
      }
      actions={
        canEdit && members.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            loading={ungroup.isPending}
            onClick={() => ungroup.mutate()}
          >
            この企業をグループから外す
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert tone="error" className="mb-3">
          {errorMessageOf(error)}
        </Alert>
      )}
      {members.length > 0 && (
        <GroupTable company={company} members={members} appointments={company.groupAppointments} />
      )}
      {candidates.length > 0 && canEdit && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-sub">
            同じ会社名の企業があります。同じ会社の別の部署・事業所なら、チェックしてまとめてください（電話番号と架電の記録はそれぞれ別のままです）。
          </p>
          <ul className="flex flex-col gap-1">
            {candidates.map((other) => (
              <li key={other.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="check-input"
                    checked={ticked.has(other.id)}
                    onChange={(event) =>
                      setTicked((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(other.id);
                        else next.delete(other.id);
                        return next;
                      })
                    }
                  />
                  <span className="font-bold">{place(other)}</span>
                  {other.phone && <span className="text-ink-sub tabular-nums">{other.phone}</span>}
                  <Link
                    to={paths.company(other.id)}
                    className="ml-auto text-xs text-link hover:underline"
                  >
                    開く
                  </Link>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={ticked.size === 0}
              loading={group.isPending}
              onClick={() =>
                group.mutate({ companyIds: [...ticked] }, { onSuccess: () => setTicked(new Set()) })
              }
            >
              {`チェックした${ticked.size || ''}件を同じ会社の部署・事業所としてまとめる`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** One line of address: 都道府県, 市区町村 and the rest (not repeated when already in it). */
function fullAddress(company: CompanyListItem): string {
  const rest = company.address ?? '';
  const head = [company.prefecture, company.city]
    .filter((part): part is string => Boolean(part) && !rest.includes(part as string))
    .join('');
  return `${head}${rest}`;
}

/**
 * The group as a table (テレマ 11/19): every column of the 架電用 list for each office and
 * department, plus its latest appointment — so an appointment already won with another
 * office (e.g. 姫路) is seen at a glance. The company on screen is marked ▶ 表示中.
 */
function GroupTable({
  company,
  members,
  appointments,
}: {
  company: CompanyDetail;
  members: CompanyRefWithDepartment[];
  appointments: Record<string, GroupAppointmentDto>;
}) {
  const grades = useOptionList(OptionCategory.CallGrade);
  const results = useOptionList(OptionCategory.CallResult);
  const today = jstDate(new Date());
  // Request 11/27: the order stays put when another office is opened (registration order,
  // or the column chosen); the office on screen is only marked ▶ 表示中.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'registered',
    desc: false,
  });
  const unsorted: { item: CompanyListItem; self: boolean; root: boolean }[] = [
    { item: company, self: true, root: false },
    ...members.flatMap((member) =>
      member.row ? [{ item: member.row, self: false, root: member.isGroupRoot }] : [],
    ),
  ];
  const value = (row: (typeof unsorted)[number]): string | number => {
    const { item } = row;
    switch (sort.key) {
      case 'name':
        return place(item);
      case 'phone':
        return item.phone ?? '';
      case 'address':
        return fullAddress(item);
      case 'station':
        return item.nearestStation ?? '';
      case 'grade':
        return item.lastCall?.grade ?? '';
      case 'result':
        return item.lastCall?.resultCode ? results.labelOf(item.lastCall.resultCode) : '';
      case 'lastCall':
        return item.lastCall?.calledAt ?? '';
      case 'count':
        return item.callCount;
      case 'telemarketer':
        return item.lastCall?.telemarketer.name ?? '';
      case 'appointment':
        return appointments[item.id]?.startsAt ?? '';
      case 'list':
        return item.listName ?? '';
      default:
        return item.createdAt;
    }
  };
  const rows = [...unsorted].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    // Empty cells go last either way.
    if (x === '' && y !== '') return 1;
    if (y === '' && x !== '') return -1;
    const order =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'ja', { numeric: true });
    return (sort.desc ? -order : order) || a.item.createdAt.localeCompare(b.item.createdAt);
  });
  const header = (key: SortKey, label: string, className?: string) => (
    <SortTh
      label={label}
      active={sort.key === key}
      desc={sort.desc}
      className={className}
      onClick={() =>
        setSort((current) =>
          current.key === key ? { key, desc: !current.desc } : { key, desc: false },
        )
      }
    />
  );
  // Another office already has an appointment coming up: said in words above the table.
  const elsewhere = rows.filter(({ item, self }) => {
    const appointment = appointments[item.id];
    return (
      !self &&
      appointment &&
      appointment.status === 'SCHEDULED' &&
      jstDate(new Date(appointment.startsAt)) >= today
    );
  });
  const cell = 'px-2 py-2 text-xs whitespace-nowrap';

  return (
    <div className="mb-4 flex flex-col gap-2">
      {elsewhere.map(({ item }) => {
        const appointment = appointments[item.id];
        if (!appointment) return null;
        return (
          <Alert key={item.id} tone="info">
            <span className="flex flex-wrap items-center gap-1.5">
              <CalendarCheck aria-hidden="true" className="size-4 shrink-0" />
              同じ会社の
              <span className="font-bold">{place(item)}</span>
              で、{formatDate(jstDate(new Date(appointment.startsAt)))}{' '}
              {formatTime(appointment.startsAt)} にアポがあります（担当：{appointment.salesRep.name}
              ）。
              <Link to={paths.appointment(appointment.id)} className="text-link hover:underline">
                アポを開く
              </Link>
            </span>
          </Alert>
        );
      })}
      <div className="border border-line">
        <Table>
          <thead>
            <tr className="[&>th]:px-2 [&>th]:text-xs">
              {header('name', '事業所・部署', 'pl-3')}
              {header('phone', '電話番号')}
              {header('address', '住所')}
              {header('station', '最寄駅')}
              {header('grade', '判定')}
              {header('result', '最新テレマ結果')}
              {header('lastCall', '最新テレマ日')}
              {header('count', '回数', 'text-right')}
              {header('telemarketer', 'テレマ担当者')}
              {header('appointment', 'アポ')}
              {header('list', 'リスト名', 'pr-3')}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, self, root }) => {
              const last = item.lastCall;
              const appointment = appointments[item.id];
              const address = fullAddress(item);
              const name = place(item);
              return (
                <tr
                  key={item.id}
                  className={cn(
                    self &&
                      'bg-main-soft/70 shadow-[inset_4px_0_0_var(--color-main)] [&>td]:font-bold',
                  )}
                >
                  <Td className={cn(cell, 'pl-3')}>
                    <span className="flex items-center gap-1.5">
                      {self ? (
                        <>
                          <span aria-hidden="true" className="text-main">
                            ▶
                          </span>
                          <span>{name}</span>
                          <span className="border border-main bg-main px-1.5 text-[10px] leading-4 font-bold text-white">
                            表示中
                          </span>
                        </>
                      ) : (
                        <>
                          <Link
                            to={paths.company(item.id)}
                            className="font-bold text-link hover:underline"
                          >
                            {name}
                          </Link>
                          {root && <Badge tone="outline">代表</Badge>}
                        </>
                      )}
                    </span>
                  </Td>
                  <Td className={cn(cell, 'tabular-nums')}>{item.phone}</Td>
                  <Td className={cn(cell, 'max-w-72')} title={address || undefined}>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate">{address}</span>
                      <MapLinks address={address} station={item.nearestStation} compact />
                    </span>
                  </Td>
                  <Td className={cell}>{item.nearestStation}</Td>
                  <Td className={cell} title={last ? grades.labelOf(last.grade) : undefined}>
                    {last?.grade ?? <span className="font-normal text-ink-sub">未架電</span>}
                  </Td>
                  <Td className={cn(cell, 'max-w-36 truncate')}>
                    {last?.resultCode ? results.labelOf(last.resultCode) : ''}
                  </Td>
                  <Td className={cn(cell, 'tabular-nums')}>
                    {last ? formatDate(jstDate(new Date(last.calledAt))) : ''}
                  </Td>
                  <Td className={cn(cell, 'text-right tabular-nums')}>
                    {item.callCount > 0 ? item.callCount : ''}
                  </Td>
                  <Td className={cell}>{last?.telemarketer.name ?? ''}</Td>
                  <Td className={cell}>
                    {appointment ? (
                      <Link
                        to={paths.appointment(appointment.id)}
                        className="inline-flex items-center gap-1 border border-success/40 bg-success-soft px-1.5 leading-5 font-bold text-success hover:underline"
                      >
                        <CalendarCheck aria-hidden="true" className="size-3.5" />
                        {formatDate(jstDate(new Date(appointment.startsAt)))}・
                        {appointment.salesRep.name}
                      </Link>
                    ) : (
                      ''
                    )}
                  </Td>
                  <Td
                    className={cn(cell, 'max-w-48 truncate pr-3 font-normal text-ink-sub')}
                    title={item.listName ?? undefined}
                  >
                    {item.listName}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

type SortKey =
  | 'registered'
  | 'name'
  | 'phone'
  | 'address'
  | 'station'
  | 'grade'
  | 'result'
  | 'lastCall'
  | 'count'
  | 'telemarketer'
  | 'appointment'
  | 'list';

/** A column header that sorts the table (click again to reverse). */
function SortTh({
  label,
  active,
  desc,
  className,
  onClick,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  className?: string;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <Th className={className} aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}>
      <button
        type="button"
        onClick={onClick}
        title={`${label}で並べ替え`}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-main',
          active && 'text-main',
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cn('size-3.5', !active && 'opacity-40')} />
      </button>
    </Th>
  );
}
