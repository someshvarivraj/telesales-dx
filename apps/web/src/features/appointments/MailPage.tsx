import type { EmailDraftDto } from '@telesales/shared';
import { CircleCheck, RefreshCw, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryState } from '@/components/ui/QueryState';
import { Textarea } from '@/components/ui/Textarea';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { type MailKind, useMailActions, useMailDraft } from './api';

const TITLE: Record<MailKind, string> = {
  booking: '営業さんへの伝達事項（N1）',
  cancellation: '取り消しのお知らせ（N8）',
  dayBefore: '前日確認の結果（N14）',
};

function splitAddresses(text: string): string[] {
  return text
    .split(/[\s,;、]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Preview → check → send (spec §8). Each e-mail is sent once; corrections go out as 【再送】. */
export function MailPage() {
  const { id = '', kind = 'booking' } = useParams();
  const mailKind = (
    ['booking', 'cancellation', 'dayBefore'].includes(kind) ? kind : 'booking'
  ) as MailKind;
  const draft = useMailDraft(id, mailKind);
  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={paths.appointment(id)} className="hover:underline">
            アポのページへ戻る
          </Link>
        }
        title={TITLE[mailKind]}
      />
      <QueryState query={draft}>
        {(email) => (
          <MailEditor
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

function MailEditor({
  appointmentId,
  kind,
  email,
}: {
  appointmentId: string;
  kind: MailKind;
  email: EmailDraftDto;
}) {
  const actions = useMailActions(appointmentId, kind);
  const [form, setForm] = useState({
    to: email.to.join(', '),
    cc: email.cc.join(', '),
    subject: email.subject,
    body: email.body,
  });
  const sent = email.status === 'SENT';
  const error =
    actions.save.error ?? actions.send.error ?? actions.regenerate.error ?? actions.resend.error;

  const saveThenSend = async () => {
    await actions.save.mutateAsync({
      id: email.id,
      request: {
        to: splitAddresses(form.to),
        cc: splitAddresses(form.cc),
        subject: form.subject,
        body: form.body,
      },
    });
    await actions.send.mutateAsync(email.id);
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
      {sent ? (
        <Alert tone="success">
          <span className="flex flex-wrap items-center gap-2">
            <CircleCheck className="size-4" aria-hidden="true" />
            {email.sentAt && formatDateTime(email.sentAt)}
            に送信しました。同じメールは二度送られません。
            {kind === 'booking' && (
              <button
                type="button"
                className="cursor-pointer font-bold text-link hover:underline"
                onClick={() => actions.resend.mutate()}
              >
                内容を直して【再送】する
              </button>
            )}
          </span>
        </Alert>
      ) : (
        <Alert tone="info">内容を確かめてから「送信」を押してください。本文は直せます。</Alert>
      )}
      <Card>
        <div className="flex flex-col gap-4">
          <FormField
            label="宛先（TO）"
            required
            hint="複数のときはカンマで区切ります。宛先の初期値は管理画面の「通知の宛先」で変えられます。"
          >
            {(c) => (
              <TextInput
                {...c}
                value={form.to}
                disabled={sent}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="CC">
            {(c) => (
              <TextInput
                {...c}
                value={form.cc}
                disabled={sent}
                onChange={(e) => setForm({ ...form, cc: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="件名" required>
            {(c) => (
              <TextInput
                {...c}
                value={form.subject}
                disabled={sent}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="本文" required>
            {(c) => (
              <Textarea
                {...c}
                rows={22}
                value={form.body}
                disabled={sent}
                className="font-mono text-sm"
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            )}
          </FormField>
        </div>
      </Card>
      {!sent && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="text"
            icon={<RefreshCw className="size-4" aria-hidden="true" />}
            loading={actions.regenerate.isPending}
            onClick={() => actions.regenerate.mutate(email.id)}
          >
            いまのアポの内容で作り直す
          </Button>
          <Link
            to={paths.appointment(appointmentId)}
            className="inline-flex h-10 items-center rounded-(--radius-control) border border-line bg-surface px-4 text-sm font-bold hover:bg-column"
          >
            あとで送る
          </Link>
          <Button
            size="lg"
            icon={<Send className="size-4" aria-hidden="true" />}
            loading={actions.save.isPending || actions.send.isPending}
            disabled={
              splitAddresses(form.to).length === 0 || !form.subject.trim() || !form.body.trim()
            }
            onClick={() => void saveThenSend().catch(() => undefined)}
          >
            送信
          </Button>
        </div>
      )}
    </div>
  );
}
