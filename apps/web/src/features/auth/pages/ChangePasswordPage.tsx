import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_HOME_PATH } from '@telesales/shared';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { PasswordInput } from '@/components/ui/TextInput';
import { ja } from '@/i18n/ja';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { type ChangePasswordFormValues, changePasswordFormSchema } from '../formSchemas';
import { useChangePassword, useCurrentUser } from '../hooks/useSession';

export function ChangePasswordPage() {
  const user = useCurrentUser();
  const changePassword = useChangePassword();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    changePassword.mutate(
      { currentPassword, newPassword },
      { onSuccess: (updated) => navigate(ROLE_HOME_PATH[updated.role], { replace: true }) },
    );
  });

  return (
    <AuthLayout title={ja.auth.changePasswordTitle}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {user.mustChangePassword && <Alert tone="info">{ja.auth.mustChangePassword}</Alert>}
        {changePassword.isError && (
          <Alert tone="error">{errorMessageOf(changePassword.error)}</Alert>
        )}

        {/* Hidden username helps password managers save the new credentials. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={user.email}
          readOnly
          hidden
        />

        <FormField label={ja.auth.currentPassword} required error={errors.currentPassword?.message}>
          {(control) => (
            <PasswordInput
              {...control}
              {...register('currentPassword')}
              autoComplete="current-password"
              autoFocus
            />
          )}
        </FormField>

        <FormField
          label={ja.auth.newPassword}
          required
          hint={ja.auth.passwordHint}
          error={errors.newPassword?.message}
        >
          {(control) => (
            <PasswordInput {...control} {...register('newPassword')} autoComplete="new-password" />
          )}
        </FormField>

        <FormField label={ja.auth.confirmPassword} required error={errors.confirmPassword?.message}>
          {(control) => (
            <PasswordInput
              {...control}
              {...register('confirmPassword')}
              autoComplete="new-password"
            />
          )}
        </FormField>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={changePassword.isPending}
          loadingLabel={ja.auth.changing}
        >
          {ja.auth.submitChangePassword}
        </Button>
      </form>
    </AuthLayout>
  );
}
