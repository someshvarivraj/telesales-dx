import type { CommentDto } from '@telesales/shared';
import { Permission } from '@telesales/shared';
import { MessageSquare, Reply } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Textarea';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useAddComment, useComments } from '@/features/calls/api';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';

interface CommentThreadProps {
  appointmentId?: string;
  callRecordId?: string;
  /** Show the empty state text (off for compact use under a call record). */
  showEmpty?: boolean;
}

function CommentForm({
  onSubmit,
  pending,
  placeholder,
  autoFocus,
}: {
  onSubmit: (body: string) => Promise<unknown>;
  pending: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState('');
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        void onSubmit(body.trim()).then(() => setBody(''));
      }}
    >
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
      <div className="flex justify-end">
        <Button type="submit" size="md" loading={pending} disabled={!body.trim()}>
          送信
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  onReply,
  canWrite,
}: {
  comment: CommentDto;
  onReply: (parentId: string, body: string) => Promise<unknown>;
  canWrite: boolean;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="flex flex-col gap-2">
      <div className="rounded-(--radius-control) bg-canvas px-3.5 py-2.5">
        <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-sub">
          <span className="font-bold text-ink">{comment.author.name}</span>
          <span>{formatDateTime(comment.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
      </div>
      {comment.replies.length > 0 && (
        <ul className="ml-5 flex flex-col gap-2 border-l-2 border-line pl-3">
          {comment.replies.map((reply) => (
            <li key={reply.id} className="rounded-(--radius-control) bg-canvas px-3.5 py-2.5">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-ink-sub">
                <span className="font-bold text-ink">{reply.author.name}</span>
                <span>{formatDateTime(reply.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="ml-5">
          {replying ? (
            <CommentForm
              pending={false}
              placeholder="返信を書く"
              autoFocus
              onSubmit={(body) => onReply(comment.id, body).then(() => setReplying(false))}
            />
          ) : (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 px-2 text-xs font-bold text-ink-sub transition-colors hover:bg-hover hover:text-ink"
            >
              <Reply aria-hidden="true" className="size-3.5" />
              返信
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Questions and comments (N18 notifies the people involved). */
export function CommentThread({
  appointmentId,
  callRecordId,
  showEmpty = true,
}: CommentThreadProps) {
  const target = appointmentId ? { appointmentId } : { callRecordId: callRecordId ?? '' };
  const query = useComments(target);
  const add = useAddComment();
  const canWrite = usePermission(Permission.WriteComments);
  const submit = (body: string, parentId?: string) =>
    add.mutateAsync({ ...target, body, parentId: parentId ?? null });

  return (
    <div className="flex flex-col gap-4">
      {add.isError && <Alert tone="error">{errorMessageOf(add.error)}</Alert>}
      {query.data && query.data.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {query.data.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canWrite={canWrite}
              onReply={(parentId, body) => submit(body, parentId)}
            />
          ))}
        </ul>
      ) : (
        showEmpty && (
          <EmptyState icon={<MessageSquare className="size-6" aria-hidden="true" />}>
            まだコメントはありません。質問や相談はここに書いてください。
          </EmptyState>
        )
      )}
      {canWrite && (
        <CommentForm
          pending={add.isPending}
          placeholder="質問・コメントを書く"
          onSubmit={(body) => submit(body)}
        />
      )}
    </div>
  );
}
