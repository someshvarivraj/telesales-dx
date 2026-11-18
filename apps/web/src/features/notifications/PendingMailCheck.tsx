import { type EmailDraftDto, familyName, operatorRoleLabel } from '@telesales/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { showDone } from '@/components/ui/feedback';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { apiClient } from '@/lib/api/ApiClient';
import { errorMessageOf } from '@/lib/api/errorMessage';

const pendingKey = ['mail', 'pending'] as const;

/**
 * 「メールの確認」 (Sano 11/18): every e-mail a person's action causes waits until they have
 * seen it — the recipients, the subject and the whole text — and pressed 送信. Shown here once
 * for the whole app, right after whatever action made the mail, so no screen can skip it.
 * 「送らない」 drops the mail; closing the window keeps it waiting for later.
 */
export function PendingMailCheck() {
  const queryClient = useQueryClient();
  // The sender is added when the mail goes out (Sano 10/24 No.6); shown here first, as on the
  // mail page, so what is checked is what is sent.
  const user = useCurrentUser();
  const senderTag = `【担当：${familyName(user.name)}】`;
  const senderLine = `送信者：${user.name}（${operatorRoleLabel(user.roles)}）`;
  const pending = useQuery({
    queryKey: pendingKey,
    queryFn: ({ signal }) => apiClient.get<EmailDraftDto[]>('/mail/pending', signal),
    staleTime: 0,
  });
  // Any saved action may have made a mail: look again after each one.
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.mutation.state.status === 'success' &&
        event.mutation.options.mutationKey?.[0] !== 'mail-pending'
      ) {
        void queryClient.invalidateQueries({ queryKey: pendingKey });
      }
    });
  }, [queryClient]);

  // Closed with ×: asked again on the next visit, not at once.
  const [later, setLater] = useState<Set<string>>(() => new Set());
  const waiting = (pending.data ?? []).filter((mail) => !later.has(mail.id));
  const mail = waiting[0];

  const done = () => void queryClient.invalidateQueries({ queryKey: pendingKey });
  const send = useMutation({
    mutationKey: ['mail-pending', 'send'],
    mutationFn: (id: string) => apiClient.post<EmailDraftDto>(`/mail/pending/${id}/send`),
    onSuccess: () => {
      showDone('メールを送信しました');
      done();
    },
  });
  const discard = useMutation({
    mutationKey: ['mail-pending', 'discard'],
    mutationFn: (id: string) => apiClient.post<unknown>(`/mail/pending/${id}/discard`),
    onSuccess: () => {
      showDone('メールは送りませんでした');
      done();
    },
  });
  const busy = send.isPending || discard.isPending;
  const error = send.error ?? discard.error;

  if (!mail) return null;
  return (
    <Dialog
      open
      size="lg"
      title={`メールの確認${waiting.length > 1 ? `（${waiting.length}件）` : ''}`}
      onClose={() => setLater((ids) => new Set(ids).add(mail.id))}
      footer={
        <>
          <Button
            variant="secondary"
            className="mr-auto"
            icon={<X aria-hidden="true" className="size-4" />}
            disabled={busy}
            loading={discard.isPending}
            onClick={() => discard.mutate(mail.id)}
          >
            送らない
          </Button>
          <Button
            size="lg"
            icon={<Send aria-hidden="true" className="size-4" />}
            disabled={busy}
            loading={send.isPending}
            onClick={() => send.mutate(mail.id)}
          >
            送信
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info">
          <span className="flex items-start gap-2">
            <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            いまの操作で、次のメールが送られます。宛先と内容を確かめて「送信」を押してください。送らない場合は「送らない」を押してください。
          </span>
        </Alert>
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-2 border-b border-line pb-4 text-sm">
          <dt className="font-bold text-ink-sub">宛先</dt>
          <dd className="break-all">{mail.to.join(', ') || '―'}</dd>
          <dt className="font-bold text-ink-sub">CC</dt>
          <dd className="break-all">{mail.cc.join(', ') || '―'}</dd>
          <dt className="font-bold text-ink-sub">件名</dt>
          <dd className="font-bold">
            {mail.subject}
            {!mail.subject.includes('【担当：') && (
              <span className="ml-1 font-normal text-ink-sub">{senderTag}</span>
            )}
          </dd>
        </dl>
        <pre className="max-h-[45vh] overflow-y-auto font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
          {mail.body}
          {!mail.body.includes('送信者：') && (
            <span className="text-ink-sub">{`\n${senderLine}`}</span>
          )}
        </pre>
      </div>
    </Dialog>
  );
}
