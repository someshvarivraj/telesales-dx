import { type EmailDraftDto, familyName, operatorRoleLabel } from '@telesales/shared';
import { ArrowLeft, RotateCcw, Save, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { MoraBot } from '@/components/brand/MoraBot';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { type MailKind, useMailActions, useMailDraft } from './api';

const TITLE: Record<MailKind, string> = {
  booking: '営業さんへの伝達事項（N1）',
  cancellation: '取り消しのお知らせ（N8）',
  dayBefore: '前日確認の結果（N14）',
};

/**
 * Preview → send (spec §8), the last step of a booking. The mail is made from the appointment and
 * cannot be changed here (11/2): 「戻って直す」 opens the appointment's edit and the mail is made
 * again from it. Each e-mail is sent once; corrections go out as 【再送】.
 */
export function MailPage() {
  const { id = '', kind = 'booking' } = useParams();
  const mailKind = (
    ['booking', 'cancellation', 'dayBefore'].includes(kind) ? kind : 'booking'
  ) as MailKind;
  const draft = useMailDraft(id, mailKind);
  return (
    <>
      <PageHeader title={TITLE[mailKind]} />
      <QueryState query={draft}>
        {(email) => (
          <MailPreview
            key={`${email.id}:${email.status}`}
            appointmentId={id}
            kind={mailKind}
            email={email}
          />
        )}
      </QueryState>
    </>
  );
}

function MailPreview({
  appointmentId,
  kind,
  email,
}: {
  appointmentId: string;
  kind: MailKind;
  email: EmailDraftDto;
}) {
  const actions = useMailActions(appointmentId, kind);
  const navigate = useNavigate();
  const location = useLocation();
  const sent = email.status === 'SENT';
  // The server adds the sender when sending (Sano 10/24 No.6); show it here first.
  const user = useCurrentUser();
  const senderTag = `【担当：${familyName(user.name)}】`;
  const senderLine = `送信者：${user.name}（${operatorRoleLabel(user.roles)}）`;
  const error =
    actions.save.error ?? actions.send.error ?? actions.regenerate.error ?? actions.resend.error;
  const appointmentPage = paths.appointment(appointmentId);

  // Back from 「戻って直す」 with the appointment saved: make the mail again from it.
  const regenerated = useRef(false);
  const { regenerate } = actions;
  useEffect(() => {
    const state = location.state as { regenerate?: boolean } | null;
    if (regenerated.current || !state?.regenerate || sent) return;
    regenerated.current = true;
    regenerate.mutate(email.id);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, regenerate, email.id, sent]);

  const request = {
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    body: email.body,
  };
  const saveDraft = () =>
    actions.save.mutate(
      { id: email.id, request },
      { onSuccess: () => navigate(appointmentPage, { state: { mailSaved: true } }) },
    );
  const send = async () => {
    await actions.save.mutateAsync({ id: email.id, request });
    await actions.send.mutateAsync(email.id);
  };
  const busy = actions.save.isPending || actions.send.isPending || actions.regenerate.isPending;

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
      {sent ? (
        <Alert tone="success">
          <span className="flex flex-wrap items-center gap-2">
            <MoraBot mood="done" size={48} title="" />
            {email.sentAt && `${formatDateTime(email.sentAt)}に送信しました。`}
            同じメールは二度送られません。
          </span>
        </Alert>
      ) : (
        <Alert tone="info">
          内容を確かめて「送信」を押してください。この画面では内容を変えられません。直すときは「戻って直す」でアポの内容を直すと、メールも作り直されます。
        </Alert>
      )}
      {!sent && email.to.length === 0 && (
        <Alert tone="warning">
          宛先がありません。管理者に「通知の宛先」の設定を頼んでください。
        </Alert>
      )}

      <Card>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-2 border-b border-line pb-4 text-sm">
          <dt className="font-bold text-ink-sub">宛先</dt>
          <dd className="break-all">{email.to.join(', ') || '―'}</dd>
          <dt className="font-bold text-ink-sub">CC</dt>
          <dd className="break-all">{email.cc.join(', ') || '―'}</dd>
          <dt className="font-bold text-ink-sub">件名</dt>
          <dd className="font-bold">
            {email.subject}
            {!sent && !email.subject.includes('【担当：') && (
              <span className="ml-1 font-normal text-ink-sub">{senderTag}</span>
            )}
          </dd>
        </dl>
        <div className="relative pt-4">
          {actions.regenerate.isPending && (
            <div className="absolute inset-0 grid place-items-center bg-surface/70">
              <Spinner className="size-6" label="作り直しています" />
            </div>
          )}
          <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
            {email.body}
            {!sent && !email.body.includes('送信者：') && (
              <span className="text-ink-sub">{`\n${senderLine}`}</span>
            )}
          </pre>
        </div>
      </Card>

      {/* Every action of this step in one place, at the end (11/2). */}
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
        {sent ? (
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="size-4" aria-hidden="true" />}
              onClick={() => navigate(appointmentPage)}
            >
              アポのページへ戻る
            </Button>
            {kind === 'booking' && (
              <Button
                className="sm:ml-auto"
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                loading={actions.resend.isPending}
                onClick={() => actions.resend.mutate()}
              >
                内容を直して【再送】する
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="size-4" aria-hidden="true" />}
              disabled={busy}
              onClick={() =>
                navigate(
                  kind === 'booking' ? `${appointmentPage}?edit=1&then=mail` : appointmentPage,
                )
              }
            >
              {kind === 'booking' ? '戻って直す' : 'アポのページへ戻る'}
            </Button>
            <div className="flex flex-col-reverse gap-3 sm:ml-auto sm:flex-row">
              <Button
                variant="secondary"
                icon={<Save className="size-4" aria-hidden="true" />}
                loading={actions.save.isPending && !actions.send.isPending}
                disabled={busy}
                onClick={saveDraft}
              >
                下書き保存
              </Button>
              <Button
                size="lg"
                icon={<Send className="size-4" aria-hidden="true" />}
                loading={actions.send.isPending}
                disabled={busy || email.to.length === 0}
                onClick={() => void send().catch(() => undefined)}
              >
                送信
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
