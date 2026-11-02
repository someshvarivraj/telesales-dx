import { type CompanyDetail, Permission } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useCompanyAvoid } from './api';

/**
 * 「回避企業に追加」 next to the phone (Sano 10/30): anyone who calls can tick it; only a lead or
 * an admin can untick it, so both ways are confirmed first. Who ticked it and when is shown.
 */
export function AvoidCheckbox({ company }: { company: CompanyDetail }) {
  const canCall = usePermission(Permission.WriteCallRecords);
  const canManage = usePermission(Permission.ManageAvoidList);
  const change = useCompanyAvoid(company.id);
  const [confirming, setConfirming] = useState(false);
  const avoided = company.avoided;
  if (!company.phone || (!canCall && !avoided)) return null;

  const locked = avoided ? !canManage : !canCall;
  const description = avoided ? (
    <>
      {avoided.by
        ? `${avoided.by.name}さんが${formatDateTime(avoided.at)}に追加`
        : `${formatDateTime(avoided.at)}に追加`}
      {avoided.source === 'LIST' && '（回避企業の一覧）'}
      {locked && <span className="block">外せるのはリーダーか管理者です</span>}
    </>
  ) : (
    '今後は架電せず、新しいリストにも入れません'
  );

  return (
    <>
      <Checkbox
        className="mt-1"
        label="回避企業に追加"
        description={description}
        checked={Boolean(avoided)}
        disabled={locked || change.isPending}
        onChange={() => setConfirming(true)}
      />
      {confirming && (
        <Dialog
          open
          title={avoided ? '回避企業から外す' : '回避企業に追加'}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                やめる
              </Button>
              <Button
                variant={avoided ? 'primary' : 'danger'}
                loading={change.isPending}
                onClick={() => change.mutate(!avoided, { onSuccess: () => setConfirming(false) })}
              >
                {avoided ? '外す' : '追加する'}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {avoided
              ? `${company.phone} を回避企業から外します。`
              : `${company.phone} を回避企業に追加します。`}
          </p>
          <p className="mt-1 text-sm">
            {avoided
              ? 'この番号のために架電対象から外した企業は、架電対象に戻ります。外したことは履歴に残ります。'
              : 'この番号の企業は架電対象から外れ、今後の取り込みにも入りません。外せるのはリーダーか管理者だけです。'}
          </p>
          {change.isError && (
            <Alert tone="error" className="mt-3">
              {errorMessageOf(change.error)}
            </Alert>
          )}
        </Dialog>
      )}
    </>
  );
}
