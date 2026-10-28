import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssistantProposal } from '@telesales/shared';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiClient } from '@/lib/api/ApiClient';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { slotProblemText } from '@/features/schedule/slotProblems';

/** The only API calls a card may make: the same ones the screens use for these actions. */
const ALLOWED = [
  /^\/plans$/,
  /^\/companies\/[0-9a-f-]{36}\/call-records$/,
  /^\/appointments\/[0-9a-f-]{36}\/change-requests$/,
];
const inApp = (path: string) => path.startsWith('/') && !path.startsWith('//');

export type CardState = 'open' | 'done' | 'dismissed';

function failureText(error: unknown): string {
  if (ApiError.isApiError(error)) {
    const problems = (error.details as { problems?: unknown[] } | undefined)?.problems;
    if (problems?.length) return problems.map(slotProblemText).join(' ');
  }
  return errorMessageOf(error);
}

/**
 * One MoraBot proposal: exactly what will be saved, and nothing happens until 確定.
 * Saving goes through the screens' own API; a slot hold opens the booking screen.
 */
export function ProposalCard({
  proposal,
  state,
  onSettled,
}: {
  proposal: AssistantProposal;
  state: CardState;
  onSettled: (state: Exclude<CardState, 'open'>, note: string) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const { request } = proposal;
      if (!request) return;
      if (!ALLOWED.some((pattern) => pattern.test(request.path))) {
        throw new Error('この操作はモラボットからは行えません。');
      }
      await apiClient.post(request.path, request.body);
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries();
      if (!proposal.request && inApp(proposal.link)) {
        void navigate(proposal.link);
        onSettled('done', `「${proposal.title}」を確定し、登録画面を開きました。`);
        return;
      }
      onSettled('done', `「${proposal.title}」を確定し、保存しました。`);
    },
    onError: (failure) => setError(failureText(failure)),
  });

  return (
    <div
      className={`w-full border bg-surface ${state === 'open' ? 'border-main-line' : 'border-line opacity-90'}`}
    >
      <p className="flex items-center justify-between gap-2 border-b border-line bg-main-soft px-3 py-1.5 text-xs font-bold text-main">
        {proposal.title}
        {state === 'done' && (
          <span className="flex items-center gap-1 text-success">
            <Check aria-hidden="true" className="size-3.5" />
            確定済み
          </span>
        )}
        {state === 'dismissed' && <span className="text-ink-sub">取りやめ</span>}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-xs">
        {proposal.lines.map((line) => (
          <div key={line.label} className="contents">
            <dt className="text-ink-sub">{line.label}</dt>
            <dd className="font-medium break-words whitespace-pre-wrap">{line.value}</dd>
          </div>
        ))}
      </dl>
      {proposal.warnings.length > 0 && (
        <ul className="mx-3 mb-2 space-y-1 bg-warning-soft px-2 py-1.5 text-[11px] text-ink">
          {proposal.warnings.map((warning) => (
            <li key={warning} className="flex gap-1">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-warning" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mx-3 mb-2 text-xs text-danger">{error}</p>}
      {state === 'open' ? (
        <div className="flex gap-2 border-t border-line px-3 py-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="flex-1 cursor-pointer bg-main px-3 py-1.5 text-xs font-bold text-white hover:bg-main-hover disabled:cursor-wait disabled:opacity-60"
          >
            {save.isPending ? '処理しています…' : proposal.confirmLabel}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => onSettled('dismissed', `「${proposal.title}」は取りやめました。`)}
            className="cursor-pointer border border-line-strong px-3 py-1.5 text-xs font-bold text-ink-sub hover:bg-hover"
          >
            やめる
          </button>
        </div>
      ) : (
        state === 'done' &&
        inApp(proposal.link) && (
          <Link
            to={proposal.link}
            className="flex items-center justify-end gap-1 border-t border-line px-3 py-1.5 text-xs font-bold text-main hover:bg-main-soft"
          >
            画面で見る
            <ArrowRight aria-hidden="true" className="size-3" />
          </Link>
        )
      )}
    </div>
  );
}
