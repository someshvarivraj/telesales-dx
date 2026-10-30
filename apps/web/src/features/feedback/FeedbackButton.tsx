import {
  FEEDBACK_FILE_TYPES,
  FEEDBACK_MAX_FILE_BYTES,
  FEEDBACK_MAX_FILES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_TYPES,
  type FeedbackDto,
  type FeedbackStatus,
  type FeedbackType,
  type FileDto,
} from '@telesales/shared';
import {
  Bug,
  CircleCheck,
  FileText,
  Film,
  Lightbulb,
  MessageSquareText,
  Paperclip,
  PenLine,
  Wrench,
  X,
} from 'lucide-react';
import { type ClipboardEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { screenName } from '@/features/assistant/parts';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useMyFeedback, useSendFeedback } from './api';

export const FEEDBACK_LABEL = 'ご意見・不具合の報告';

const TYPE_ICON: Record<FeedbackType, typeof Bug> = {
  BUG: Bug,
  REQUEST: Lightbulb,
  FIX: Wrench,
  OTHER: PenLine,
};
const TYPE_HINT: Record<FeedbackType, string> = {
  BUG: '動かない・表示がおかしい',
  REQUEST: 'こうなると便利・新しい機能',
  FIX: '文言・項目・動きを直してほしい',
  OTHER: 'そのほか何でも',
};
export const STATUS_TONE: Record<FeedbackStatus, BadgeTone> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  WAITING_DECISION: 'warning',
  RESOLVED: 'success',
};
const ACCEPT = FEEDBACK_FILE_TYPES.join(',');
const ALLOWED = new Set<string>(FEEDBACK_FILE_TYPES);

/** Where an attachment can be opened (same-origin, so the sign-in cookie applies). */
export function feedbackFileUrl(feedbackId: string, fileId: string): string {
  return `${import.meta.env.BASE_URL}api/feedback/${feedbackId}/files/${fileId}`;
}

/**
 * The 「ご意見・不具合の報告」 entry: a row in the left menu, just above the signed-in
 * person (an icon when the menu is folded), and an icon in the phone top bar.
 */
export function FeedbackButton({
  variant,
  folded = false,
}: {
  variant: 'menu' | 'icon';
  folded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === 'menu' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={folded ? FEEDBACK_LABEL : undefined}
          aria-label={folded ? FEEDBACK_LABEL : undefined}
          className={cn(
            'mb-2 flex w-full cursor-pointer items-center gap-2.5 border border-main-line bg-main-soft text-left text-main transition-colors hover:bg-main hover:text-white',
            folded ? 'h-10 justify-center' : 'px-3 py-2.5',
          )}
        >
          <MessageSquareText aria-hidden="true" className="size-4.5 shrink-0" />
          <span className="sidebar-full min-w-0">
            <span className="block text-[13px] leading-tight font-bold">{FEEDBACK_LABEL}</span>
            <span className="block text-[11px] leading-tight opacity-80">
              スクリーンショットも送れます
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={FEEDBACK_LABEL}
          title={FEEDBACK_LABEL}
          className="flex size-10 cursor-pointer items-center justify-center text-ink-sub hover:text-ink"
        >
          <MessageSquareText aria-hidden="true" className="size-5" />
        </button>
      )}
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface Attachment {
  key: string;
  file: File;
  preview: string | null;
}

function screenshotName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `screenshot-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const { name } = useCurrentUser();
  const send = useSendFeedback();
  const mine = useMyFeedback(open);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<FeedbackDto | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const screenPath = `${location.pathname}${location.search}`;
  const currentScreen = () =>
    document.querySelector('main h1')?.textContent?.trim() || screenName(location.pathname);

  // Previews are object URLs: release them when the dialog goes away for good.
  useEffect(
    () => () =>
      filesRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)),
    [],
  );

  const addFiles = (incoming: File[]) => {
    setFileError(null);
    const room = FEEDBACK_MAX_FILES - files.length;
    const accepted: Attachment[] = [];
    for (const file of incoming) {
      if (!ALLOWED.has(file.type)) {
        setFileError(
          `「${file.name}」は添付できない種類です（画像・動画・PDF・Excel・Word・テキスト）。`,
        );
        continue;
      }
      if (file.size > FEEDBACK_MAX_FILE_BYTES) {
        setFileError(`「${file.name}」は大きすぎます（1ファイル10MBまで）。`);
        continue;
      }
      if (accepted.length >= room) {
        setFileError(`添付は${FEEDBACK_MAX_FILES}つまでです。`);
        break;
      }
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  };
  const removeFile = (key: string) =>
    setFiles((prev) => {
      const gone = prev.find((item) => item.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return prev.filter((item) => item.key !== key);
    });

  const reset = () => {
    files.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setSent(null);
    setType(null);
    setBody('');
    setFiles([]);
    setFileError(null);
    setTried(false);
  };
  const close = () => {
    onClose();
    // Start fresh next time, but keep a draft that was not sent.
    if (sent) reset();
    send.reset();
  };
  const submit = () => {
    setTried(true);
    if (!type || !body.trim()) return;
    send.mutate(
      {
        type,
        body: body.trim(),
        screenPath,
        screenName: currentScreen().slice(0, 100),
        files: files.map((item) => item.file),
      },
      { onSuccess: setSent },
    );
  };

  const onPaste = (event: ClipboardEvent) => {
    const pasted = [...event.clipboardData.files];
    if (pasted.length > 0) {
      event.preventDefault();
      addFiles(
        pasted.map((file) =>
          file.name && file.name !== 'image.png'
            ? file
            : new File([file], screenshotName(), { type: file.type }),
        ),
      );
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles([...event.dataTransfer.files]);
  };

  return (
    <Dialog
      open={open}
      size="lg"
      title={FEEDBACK_LABEL}
      onClose={close}
      footer={
        sent ? (
          <>
            <Button variant="secondary" onClick={reset}>
              続けて送る
            </Button>
            <Button onClick={close}>閉じる</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              キャンセル
            </Button>
            <Button onClick={submit} loading={send.isPending}>
              送る
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CircleCheck aria-hidden="true" className="size-12 text-success" />
          <p className="text-base font-bold">送りました（No.{sent.number}）</p>
          <p className="text-sm text-ink-sub">
            担当者にメールで届きました。あなたにも控えのメールが届きます。
            <br />
            対応したら、同じ宛先にメールでお知らせします。
          </p>
        </div>
      ) : (
        <div
          className="relative flex flex-col gap-4"
          onPaste={onPaste}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={onDrop}
        >
          {dragging && (
            <div className="pointer-events-none absolute -inset-2 z-10 flex items-center justify-center border-2 border-dashed border-main bg-main-soft/90 text-sm font-bold text-main">
              ここにドロップして添付
            </div>
          )}
          {send.isError && <Alert tone="error">{errorMessageOf(send.error)}</Alert>}
          <fieldset>
            <legend className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-bold">
              報告の種類
              <span className="text-[11px] text-danger">必須</span>
            </legend>
            <div
              role="radiogroup"
              aria-label="報告の種類"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {FEEDBACK_TYPES.map((value) => {
                const Icon = TYPE_ICON[value];
                const on = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setType(value)}
                    className={cn(
                      'flex cursor-pointer flex-col items-start gap-1.5 border p-3 text-left transition-colors',
                      on
                        ? 'border-main bg-main-soft ring-1 ring-main'
                        : 'border-line bg-surface hover:border-main-line',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn('size-5 shrink-0', on ? 'text-main' : 'text-ink-sub')}
                    />
                    <span className="block text-sm font-bold">{FEEDBACK_TYPE_LABEL[value]}</span>
                    <span className="block text-xs leading-snug text-ink-sub">
                      {TYPE_HINT[value]}
                    </span>
                  </button>
                );
              })}
            </div>
            {tried && !type && <p className="mt-1.5 text-sm text-danger">種類を選んでください。</p>}
          </fieldset>
          <FormField
            label="内容"
            required
            hint="どの画面で、何をしたら、どうなったか（どうしてほしいか）を書いてください。"
            error={tried && !body.trim() ? '内容を書いてください。' : undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                rows={5}
                maxLength={4000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </FormField>

          <section aria-label="添付ファイル" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold">添付（任意）</span>
              <span className="text-xs text-ink-sub">
                {files.length}/{FEEDBACK_MAX_FILES}・1ファイル10MBまで
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => picker.current?.click()}
                disabled={files.length >= FEEDBACK_MAX_FILES}
              >
                <Paperclip aria-hidden="true" className="size-4" />
                ファイルを選ぶ
              </Button>
              <input
                ref={picker}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  addFiles([...(event.target.files ?? [])]);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="text-xs text-ink-sub">
              スクリーンショットはこの欄で Ctrl+V（Mac は
              ⌘+V）でも貼り付けられます。ファイルのドラッグ＆ドロップもできます。
            </p>
            {fileError && <p className="text-sm text-danger">{fileError}</p>}
            {files.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {files.map((item) => (
                  <li
                    key={item.key}
                    className="group relative flex aspect-square flex-col overflow-hidden border border-line bg-column"
                  >
                    {item.preview ? (
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <FileGlyph type={item.file.type} name={item.file.name} />
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-0.5 text-[10px] text-white">
                      {formatBytes(item.file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(item.key)}
                      aria-label={`${item.file.name} を外す`}
                      title="外す"
                      className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center bg-surface/90 text-ink-sub shadow-(--shadow-card) hover:text-danger"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-column px-3 py-2.5 text-xs text-ink-sub">
            <dt>送信者</dt>
            <dd className="text-ink">{name}</dd>
            <dt>画面</dt>
            <dd className="truncate text-ink">{open ? currentScreen() : ''}</dd>
            <dt>日時</dt>
            <dd className="text-ink">送った時刻が自動で記録されます</dd>
          </dl>
        </div>
      )}
      <MyReports items={mine.data ?? []} />
    </Dialog>
  );
}

function FileGlyph({ type, name }: { type: string; name: string }) {
  const Icon = type.startsWith('video/') ? Film : FileText;
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
      <Icon aria-hidden="true" className="size-6 text-ink-sub" />
      <span className="line-clamp-2 text-[10px] break-all text-ink">{name}</span>
    </span>
  );
}

/** Thumbnails of a sent report's files; each opens in a new tab. */
export function FeedbackFiles({ feedbackId, files }: { feedbackId: string; files: FileDto[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file) => {
        const url = feedbackFileUrl(feedbackId, file.id);
        return (
          <li key={file.id}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title={file.originalName}
              className="flex size-20 overflow-hidden border border-line bg-column hover:border-main"
            >
              {file.contentType.startsWith('image/') ? (
                <img src={url} alt={file.originalName} className="size-full object-cover" />
              ) : (
                <FileGlyph type={file.contentType} name={file.originalName} />
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function MyReports({ items }: { items: FeedbackDto[] }) {
  if (items.length === 0) return null;
  return (
    <details className="mt-5 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm font-bold text-ink-sub">
        これまでに送った報告（{items.length}件）
      </summary>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {items.slice(0, 20).map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-sub">
              <span>No.{item.number}</span>
              <span>{FEEDBACK_TYPE_LABEL[item.type]}</span>
              <span>{formatDateTime(item.createdAt)}</span>
              <Badge tone={STATUS_TONE[item.status]} className="ml-auto">
                {FEEDBACK_STATUS_LABEL[item.status]}
              </Badge>
            </div>
            <p className="line-clamp-2 text-sm whitespace-pre-wrap">{item.body}</p>
            <FeedbackFiles feedbackId={item.id} files={item.files} />
            {item.resolution && (
              <p className="border-l-2 border-success pl-2 text-xs whitespace-pre-wrap text-ink-sub">
                {item.resolution}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
