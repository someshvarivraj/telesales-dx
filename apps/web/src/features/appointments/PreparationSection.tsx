import type { AppointmentDetail } from '@telesales/shared';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileDrop } from '@/components/ui/FileDrop';
import { Textarea } from '@/components/ui/Textarea';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatBytes, formatDateTime } from '@/lib/format';
import { downloadAppointmentFile, useAddPreparation } from './api';

/** Sales preparation: notes and files (later the place for AI-generated materials, spec §2-6). */
export function PreparationSection({ appointment }: { appointment: AppointmentDetail }) {
  const add = useAddPreparation(appointment.id);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [open, setOpen] = useState(false);

  return (
    <Card
      title="営業の準備"
      actions={
        appointment.abilities.addPreparation && !open ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            メモ・資料を追加
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {open && (
          <div className="flex flex-col gap-3 rounded-(--radius-control) border border-main/40 p-4">
            {add.isError && <Alert tone="error">{errorMessageOf(add.error)}</Alert>}
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="準備メモ"
              placeholder="提案内容、確認したいこと、持っていく資料など"
            />
            <FileDrop
              accept="*/*"
              multiple
              hint="提案資料・会社案内など（1ファイル20MBまで）"
              onFiles={(selected) => setFiles((current) => [...current, ...selected].slice(0, 10))}
            />
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1"
                  >
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {file.name}
                    <button
                      type="button"
                      className="cursor-pointer text-ink-sub hover:text-danger"
                      aria-label={`${file.name}を外す`}
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button
                loading={add.isPending}
                disabled={!note.trim() && files.length === 0}
                onClick={() =>
                  add.mutate(
                    { note: note.trim(), files },
                    {
                      onSuccess: () => {
                        setNote('');
                        setFiles([]);
                        setOpen(false);
                      },
                    },
                  )
                }
              >
                保存する
              </Button>
            </div>
          </div>
        )}
        {appointment.preparations.length === 0 && !open ? (
          <EmptyState scene="meeting">まだ準備の記録はありません。</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {appointment.preparations.map((preparation) => (
              <li
                key={preparation.id}
                className="border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <div className="text-xs text-ink-sub">
                  <span className="mr-3 font-bold text-ink">{preparation.author.name}</span>
                  {formatDateTime(preparation.createdAt)}
                </div>
                {preparation.note && (
                  <p className="mt-1 text-sm whitespace-pre-wrap">{preparation.note}</p>
                )}
                {preparation.files.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {preparation.files.map((file) => (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadAppointmentFile(appointment.id, file.id, file.originalName)
                          }
                          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-link hover:bg-canvas"
                        >
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {file.originalName}
                          <span className="text-xs text-ink-sub">
                            {formatBytes(file.sizeBytes)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
