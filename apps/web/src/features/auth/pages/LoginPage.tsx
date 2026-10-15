import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { paths, safeRedirectTarget } from '@/app/paths';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { PasswordInput, TextInput } from '@/components/ui/TextInput';
import { ja } from '@/i18n/ja';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { type LoginFormValues, loginFormSchema } from '../formSchemas';
import { useLogin, useSession } from '../hooks/useSession';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get('redirect'));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  if (session.isPending) {
    return <FullPageSpinner />;
  }
  if (session.data) {
    // The session refetch after login can render before onSuccess navigates; honour the redirect.
    return (
      <Navigate
        to={session.data.mustChangePassword ? paths.changePassword : (redirectTo ?? paths.home)}
        replace
      />
    );
  }

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (user) => {
        if (user.mustChangePassword) {
          navigate(paths.changePassword, { replace: true });
          return;
        }
        navigate(redirectTo ?? paths.home, { replace: true });
      },
    });
  });

  return (
    <AuthLayout
      title={ja.auth.loginTitle}
      footer={ja.auth.forgotPassword}
      mood={login.isError ? 'trouble' : 'default'}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {login.isError && <Alert tone="error">{errorMessageOf(login.error)}</Alert>}

        <FormField label={ja.auth.email} error={errors.email?.message}>
          {(control) => (
            <TextInput
              {...control}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
          )}
        </FormField>

        <FormField label={ja.auth.password} error={errors.password?.message}>
          {(control) => (
            <PasswordInput {...control} {...register('password')} autoComplete="current-password" />
          )}
        </FormField>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={login.isPending}
          loadingLabel={ja.auth.loggingIn}
        >
          {ja.auth.submitLogin}
        </Button>
      </form>
    </AuthLayout>
  );
}
