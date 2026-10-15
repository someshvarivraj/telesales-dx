import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from './cn';

interface FileDropProps {
  accept: string;
  multiple?: boolean;
  hint: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/** Click or drop files. */
export function FileDrop({ accept, multiple = false, hint, onFiles, disabled }: FileDropProps) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-(--radius-card) border-2 border-dashed px-4 py-8 text-center text-sm transition-colors',
        over ? 'border-main bg-main-soft' : 'border-line bg-canvas hover:border-main/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <Upload aria-hidden="true" className="size-6 text-ink-sub" />
      <span className="font-bold text-ink">ファイルを選択、またはここにドロップ</span>
      <span className="text-ink-sub">{hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
    </label>
  );
}
