import { type ChangeRequestListItem, Permission } from '@telesales/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime, formatRange } from '@/lib/format';
import { useAppointment, useChangeRequestAction, useChangeRequests } from './api';
import { ChangeRequestBadge } from './AppointmentBadges';
import { RescheduleDialog } from './AppointmentDialogs';

function RescheduleFromRequest({
  request,
  onClose,
}: {
  request: ChangeRequestListItem;
  onClose: () => void;
}) {
  const appointment = useAppointment(request.appointmentId);
  if (!appointment.data) return null;
  return (
    <RescheduleDialog
      appointment={appointment.data}
      changeRequestId={request.id}
      onClose={onClose}
    />
  );
}

/**
 * Change requests from sales (spec §7): every telemarketer sees them; whoever takes one
 * presses 「対応する」. The status is visible to sales too.
 */
export function ChangeRequestsPage() {
  const user = useCurrentUser();
  const [openOnly, setOpenOnly] = useState(true);
  const list = useChangeRequests(openOnly);
  const action = useChangeRequestAction();
  const canHandle = usePermission(Permission.HandleChangeRequests);
  const [rescheduling, setRescheduling] = useState<ChangeRequestListItem | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="対応が終わっていないものだけ"
        checked={openOnly}
        onChange={(e) => setOpenOnly(e.target.checked)}
      />
      {action.isError && <Alert tone="error">{errorMessageOf(action.error)}</Alert>}
      <QueryState query={list}>
        {(items) =>
          items.length === 0 ? (
            <Card>
              <EmptyState mood="done">変更依頼はありません。</EmptyState>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((request) => {
                const mine = request.handler?.id === user.id;
                const open = request.status === 'REQUESTED' || request.status === 'IN_PROGRESS';
                return (
                  <li key={request.id}>
                    <Card>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ChangeRequestBadge status={request.status} />
                            <Link
                              to={paths.appointment(request.appointmentId)}
                              className="font-bold text-link hover:underline"
                            >
                              {request.appointment.company.name}
                            </Link>
                            <span className="text-sm text-ink-sub">
                              {formatRange(
                                request.appointment.startsAt,
                                request.appointment.endsAt,
                              )}
                              ・{request.appointment.salesRep.name}
                            </span>
                          </div>
                          <p className="mt-2 text-sm whitespace-pre-wrap">{request.message}</p>
                          <p className="mt-1 text-xs text-ink-sub">
                            {request.requestedBy.name}さん・{formatDateTime(request.createdAt)}
                            {request.handler && `／対応：${request.handler.name}さん`}
                          </p>
                        </div>
                        {canHandle && open && (
                          <div className="flex flex-wrap gap-2">
                            {request.status === 'REQUESTED' && (
                              <Button
                                loading={action.isPending && action.variables.id === request.id}
                                onClick={() => action.mutate({ id: request.id, action: 'take' })}
                              >
                                対応する
                              </Button>
                            )}
                            {(mine || request.status === 'REQUESTED') && (
                              <Button variant="secondary" onClick={() => setRescheduling(request)}>
                                日時を変更
                              </Button>
                            )}
                            {mine && (
                              <Button
                                variant="text"
                                onClick={() => action.mutate({ id: request.id, action: 'done' })}
                              >
                                変更なしで完了
                              </Button>
                            )}
                          </div>
                        )}
                        {!canHandle &&
                          request.requestedBy.id === user.id &&
                          request.status === 'REQUESTED' && (
                            <Button
                              variant="text"
                              onClick={() => action.mutate({ id: request.id, action: 'withdraw' })}
                            >
                              取り下げる
                            </Button>
                          )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </QueryState>
      {rescheduling && (
        <RescheduleFromRequest request={rescheduling} onClose={() => setRescheduling(null)} />
      )}
    </div>
  );
}
