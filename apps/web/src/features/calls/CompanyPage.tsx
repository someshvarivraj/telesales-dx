import {
  AppointmentSource,
  type CallRecordDto,
  jstDate,
  OptionCategory,
  Permission,
} from '@telesales/shared';
import { CalendarPlus, MessageSquare, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { CommentThread } from '@/features/comments/CommentThread';
import { useAppointments } from '@/features/appointments/api';
import { AppointmentStatusBadge } from '@/features/appointments/AppointmentBadges';
import { useOptionList } from '@/features/reference/useReference';
import { formatDate, formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useCallRecords, useCompany } from './api';
import { FlagBadge, GradeBadge } from './CallBadges';
import { CallRecordForm } from './CallRecordForm';
import { CompanyEditDialog } from './CompanyEditDialog';
import { FindRepDialog } from './FindRepDialog';

function CallRecordItem({ record, companyId }: { record: CallRecordDto; companyId: string }) {
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const grades = useOptionList(OptionCategory.CallGrade);
  const interest = useOptionList(OptionCategory.InterestLevel);

  if (editing) {
    return (
      <li className="rounded-(--radius-control) border border-main/40 p-4">
        <CallRecordForm
          companyId={companyId}
          editing={record}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <GradeBadge grade={record.grade} label={grades.labelOf(record.grade)} />
        <span className="text-sm font-bold">{record.telemarketer.name}</span>
        <span className="text-xs text-ink-sub">{formatDateTime(record.calledAt)}</span>
        <div className="ml-auto flex gap-1">
          <Button
            variant="text"
            className="h-8 px-2"
            icon={<MessageSquare className="size-4" aria-hidden="true" />}
            onClick={() => setShowComments((v) => !v)}
          >
            コメント{record.commentCount > 0 ? `（${record.commentCount}）` : ''}
          </Button>
          {record.canEdit && (
            <Button
              variant="text"
              className="h-8 px-2"
              icon={<Pencil className="size-4" aria-hidden="true" />}
              onClick={() => setEditing(true)}
            >
              編集
            </Button>
          )}
        </div>
      </div>
      {record.resultDetail && <p className="text-sm whitespace-pre-wrap">{record.resultDetail}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-sub">
        {record.contactName && <span>先方：{record.contactName}</span>}
        {record.interestLevel && <span>乗り気度：{interest.labelOf(record.interestLevel)}</span>}
        {record.nextCallDate && <span>次回架電日：{formatDate(record.nextCallDate)}</span>}
      </div>
      {record.notes && <p className="text-xs whitespace-pre-wrap text-ink-sub">{record.notes}</p>}
      {showComments && (
        <div className="mt-1 rounded-(--radius-control) border border-line p-3">
          <CommentThread callRecordId={record.id} showEmpty={false} />
        </div>
      )}
    </li>
  );
}

/** One company: info, past call records and the call result form on the same screen (spec §6). */
export function CompanyPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const company = useCompany(id);
  const records = useCallRecords(id);
  const appointments = useAppointments({ companyId: id, page: 1, pageSize: 20 });
  const canCall = usePermission(Permission.WriteCallRecords);
  const canBook = usePermission(Permission.ManageTelemaAppointments);
  const canEdit = usePermission(Permission.EditCompanies);
  const customerTypes = useOptionList(OptionCategory.CustomerType);
  const [editOpen, setEditOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(false);
  const [justSavedA, setJustSavedA] = useState<CallRecordDto | null>(null);

  const companyAppointments = appointments.data?.items ?? [];

  const openSchedule = (repId: string, webOnly: boolean) => {
    const latest = justSavedA ?? records.data?.find((record) => record.grade === 'A') ?? null;
    const params = new URLSearchParams({
      source: AppointmentSource.CallStatus,
      companyId: id,
      repId,
      ...(latest ? { callRecordId: latest.id } : {}),
      ...(webOnly ? { format: 'ONLINE' } : {}),
    });
    navigate(`${paths.book}?${params.toString()}`);
  };

  return (
    <QueryState query={company}>
      {(data) => (
        <>
          <PageHeader
            eyebrow={
              <Link to={paths.calls} className="hover:underline">
                {ja.module.calls}
              </Link>
            }
            title={
              <span className="flex flex-wrap items-center gap-2">
                {data.name}
                <FlagBadge flag={data.flag} />
              </span>
            }
            actions={
              <>
                {canEdit && (
                  <Button
                    variant="secondary"
                    icon={<Pencil className="size-4" aria-hidden="true" />}
                    onClick={() => setEditOpen(true)}
                  >
                    企業情報を編集
                  </Button>
                )}
                {canBook && (
                  <Button
                    icon={<CalendarPlus className="size-4" aria-hidden="true" />}
                    onClick={() => setRepOpen(true)}
                  >
                    担当営業を判定して予定を開く
                  </Button>
                )}
              </>
            }
          />

          <div className="mb-5 flex flex-col gap-2">
            {data.similarNumbers.length > 0 && (
              <Alert tone="warning">
                同じ会社の近い番号があります：
                {data.similarNumbers.map((other) => (
                  <Link
                    key={other.id}
                    to={paths.company(other.id)}
                    className="ml-2 font-bold text-link hover:underline"
                  >
                    {other.name}（{other.phone}）
                  </Link>
                ))}
                。架電するか判断してください。
              </Alert>
            )}
            {data.flagMatches.length > 0 && data.flag !== 'NONE' && (
              <Alert tone={data.flag === 'DUPLICATE' ? 'error' : 'warning'}>
                {data.flag === 'DUPLICATE'
                  ? '電話番号が同じ企業があります（リーダーが扱いを決めるまで架電対象から外れます）：'
                  : '会社名が同じ企業があります：'}
                {data.flagMatches.map((other) => (
                  <Link
                    key={other.id}
                    to={paths.company(other.id)}
                    className="ml-2 font-bold text-link hover:underline"
                  >
                    {other.name}
                  </Link>
                ))}
              </Alert>
            )}
            {justSavedA && canBook && (
              <Alert tone="success">
                アポ獲得で保存しました。
                <button
                  type="button"
                  onClick={() => setRepOpen(true)}
                  className="ml-2 cursor-pointer font-bold text-link hover:underline"
                >
                  担当営業を判定してアポを登録する
                </button>
              </Alert>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-5 lg:col-span-2">
              {canCall && (
                <Card title="架電結果を入力">
                  <CallRecordForm
                    companyId={id}
                    onSaved={(record) => setJustSavedA(record.grade === 'A' ? record : null)}
                  />
                </Card>
              )}
              <Card title="これまでの架電">
                <QueryState query={records}>
                  {(list) =>
                    list.length === 0 ? (
                      <EmptyState scene="calling">まだ架電記録はありません。</EmptyState>
                    ) : (
                      <ul className="flex flex-col gap-4">
                        {list.map((record) => (
                          <CallRecordItem key={record.id} record={record} companyId={id} />
                        ))}
                      </ul>
                    )
                  }
                </QueryState>
              </Card>
            </div>
            <div className="flex flex-col gap-5">
              <Card title="企業情報">
                <DescriptionList
                  items={[
                    {
                      label: '電話番号',
                      value: data.phone ? (
                        <a className="text-link" href={`tel:${data.phone}`}>
                          {data.phone}
                        </a>
                      ) : null,
                    },
                    {
                      label: 'URL',
                      value: data.url ? (
                        <a
                          className="break-all text-link"
                          href={data.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {data.url}
                        </a>
                      ) : null,
                      wide: true,
                    },
                    { label: '住所', value: data.address, wide: true },
                    { label: '事業所', value: data.office },
                    { label: '部署', value: data.department },
                    { label: '最寄駅', value: data.nearestStation },
                    { label: '業種', value: data.industry },
                    { label: '取引区分', value: customerTypes.labelOf(data.customerType) },
                    { label: 'クライアントNo', value: data.clientNo },
                    {
                      label:
                        data.imports.length > 1 ? `リスト（${data.imports.length}件）` : 'リスト名',
                      value:
                        data.imports.length > 0 ? (
                          <ul className="flex flex-col gap-0.5">
                            {data.imports.map((entry) => (
                              <li key={`${entry.listImportId}:${entry.rowNumber}`}>
                                {entry.listName}
                                <span className="ml-2 text-xs text-ink-sub">
                                  {formatDate(jstDate(new Date(entry.importedAt)))}・
                                  {entry.rowNumber}行目
                                  {entry.status !== 'IMPORTED' &&
                                    `・${ja.importRowStatus[entry.status]}`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          data.listName
                        ),
                      wide: true,
                    },
                    { label: '旧社名', value: data.formerNames.join('、'), wide: true },
                    ...Object.entries(data.extra ?? {}).map(([label, value]) => ({
                      label,
                      value,
                      wide: true,
                    })),
                  ]}
                />
              </Card>
              <Card title="この会社のアポ">
                {companyAppointments.length === 0 ? (
                  <EmptyState scene="schedule">まだアポはありません。</EmptyState>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {companyAppointments.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={paths.appointment(item.id)}
                          className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-line px-3 py-2 hover:bg-canvas"
                        >
                          <span className="text-sm font-bold">{formatDateTime(item.startsAt)}</span>
                          <span className="text-sm">{item.salesRep.name}</span>
                          <AppointmentStatusBadge status={item.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {editOpen && (
            <CompanyEditDialog company={data} open={editOpen} onClose={() => setEditOpen(false)} />
          )}
          <FindRepDialog
            open={repOpen}
            onClose={() => setRepOpen(false)}
            companyId={id}
            onChoose={openSchedule}
          />
        </>
      )}
    </QueryState>
  );
}
