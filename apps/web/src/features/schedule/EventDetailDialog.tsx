import { OptionCategory, Permission } from '@telesales/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Dialog } from '@/components/ui/Dialog';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { useOptionList } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatRange } from '@/lib/format';
import { ja } from '@/i18n/ja';
import { useConfirmCandidate, useDeletePlan, useDeleteTimeOff } from './api';
import { type CalendarEvent, EVENT_STYLE } from './events';

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}

export function EventDetailDialog({ event, onClose, onEdit }: EventDetailDialogProps) {
  const { permissions } = useCurrentUser();
  const types = useOptionList(OptionCategory.PlanType);
  const deletePlan = useDeletePlan();
  const deleteTimeOff = useDeleteTimeOff();
  const confirm = useConfirmCandidate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!event) return null;

  const plan = event.plan;
  const error = deletePlan.error ?? deleteTimeOff.error ?? confirm.error;
  const canEditTimeOff = [
    Permission.WriteSalesPlans,
    Permission.WriteShifts,
    Permission.Administer,
  ].some((p) => permissions.includes(p));
  const close = () => {
    setConfirmDelete(false);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title={EVENT_STYLE[event.kind].label}
      footer={
        <>
          {plan?.appointment && (
            <Link
              to={paths.appointment(plan.appointment.id)}
              className="inline-flex h-10 items-center rounded-(--radius-control) bg-main px-4 text-sm font-bold text-white hover:bg-main-hover"
            >
              アポのページを開く
            </Link>
          )}
          {plan?.canEdit && plan.status === 'TENTATIVE' && (
            <Button
              variant="secondary"
              loading={confirm.isPending}
              onClick={() => confirm.mutate(plan.id, { onSuccess: close })}
            >
              この候補日で確定
            </Button>
          )}
          {plan?.canEdit && (
            <>
              <Button variant="secondary" onClick={() => onEdit(event)}>
                変更
              </Button>
              {confirmDelete ? (
                <>
                  {plan.seriesId && (
                    <Button
                      variant="danger"
                      loading={deletePlan.isPending}
                      onClick={() =>
                        deletePlan.mutate({ id: plan.id, series: true }, { onSuccess: close })
                      }
                    >
                      これ以降の繰り返しも削除
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    loading={deletePlan.isPending}
                    onClick={() =>
                      deletePlan.mutate({ id: plan.id, series: false }, { onSuccess: close })
                    }
                  >
                    この予定を削除
                  </Button>
                </>
              ) : (
                <Button variant="text" onClick={() => setConfirmDelete(true)}>
                  削除
                </Button>
              )}
            </>
          )}
          {event.timeOff && canEditTimeOff && (
            <Button
              variant="danger"
              loading={deleteTimeOff.isPending}
              onClick={() =>
                event.timeOff && deleteTimeOff.mutate(event.timeOff.id, { onSuccess: close })
              }
            >
              この休みを削除
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        {plan && (
          <DescriptionList
            items={[
              { label: '会社名・タイトル', value: plan.title, wide: true },
              {
                label: '日時',
                value: plan.allDay
                  ? `${formatRange(plan.startsAt, plan.endsAt)}（終日）`
                  : formatRange(plan.startsAt, plan.endsAt),
                wide: true,
              },
              { label: '持ち主', value: plan.owner.name },
              { label: '種別', value: types.labelOf(plan.type) },
              {
                label: '状態',
                value: (
                  <Badge tone={plan.status === 'TENTATIVE' ? 'outline' : 'info'}>
                    {ja.planStatus[plan.status]}
                  </Badge>
                ),
              },
              { label: '同席者', value: plan.attendees.map((a) => a.name).join('、') },
              { label: '登録した人', value: plan.createdBy.name },
              ...(plan.holidayWork ? [{ label: '休日出勤', value: 'あり' }] : []),
              { label: 'メモ', value: plan.note, wide: true },
            ]}
          />
        )}
        {plan?.appointment?.isTelema && (
          <p className="text-xs text-ink-sub">
            テレマが取ったアポは、営業からは変更できません（アポのページから変更依頼を出せます）。
          </p>
        )}
        {event.timeOff && (
          <DescriptionList
            items={[
              { label: '誰', value: event.timeOff.user.name },
              { label: '種類', value: ja.timeOff[event.timeOff.kind] },
              {
                label: '日時',
                value: formatRange(event.timeOff.startsAt, event.timeOff.endsAt),
                wide: true,
              },
              { label: '入力した人', value: event.timeOff.enteredBy.name },
              { label: 'メモ', value: event.timeOff.note, wide: true },
            ]}
          />
        )}
        {event.lock && (
          <p className="text-sm">
            {event.lock.lockedBy.name}さんが {formatRange(event.lock.startsAt, event.lock.endsAt)}{' '}
            を編集中です。保存かキャンセルで解除されます。
          </p>
        )}
      </div>
    </Dialog>
  );
}
