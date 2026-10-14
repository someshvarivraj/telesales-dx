import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { inputClass } from './TextInput';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(inputClass, 'h-auto py-2.5 leading-relaxed', className)}
      {...rest}
    />
  );
}
