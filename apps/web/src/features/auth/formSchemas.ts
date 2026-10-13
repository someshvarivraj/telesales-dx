import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@telesales/shared';
import { z } from 'zod';
import { ja } from '@/i18n/ja';

/** Client-side schemas mirror the API rules, with Japanese messages for inline errors. */
export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, ja.validation.required(ja.auth.email))
    .pipe(z.email(ja.validation.email)),
  password: z.string().min(1, ja.validation.required(ja.auth.password)).max(PASSWORD_MAX_LENGTH),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, ja.validation.required(ja.auth.currentPassword)),
    newPassword: z
      .string()
      .min(1, ja.validation.required(ja.auth.newPassword))
      .min(PASSWORD_MIN_LENGTH, ja.validation.passwordTooShort)
      .max(PASSWORD_MAX_LENGTH),
    confirmPassword: z.string().min(1, ja.validation.required(ja.auth.confirmPassword)),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: ja.validation.passwordMismatch,
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
