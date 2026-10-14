import {
  type AdminUserDto,
  ALL_ROLES,
  Permission,
  PREFECTURE_NAMES,
  Role,
  type TemporaryPasswordResponse,
} from '@telesales/shared';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { RoleBadges } from '@/components/ui/RoleBadge';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDateTime } from '@/lib/format';
import { ja } from '@/i18n/ja';
import {
  useAdminUsers,
  useCreateUser,
  useResetPassword,
  useUnlockUser,
  useUpdateUser,
} from './api';

/** Individual exceptions kept as data (spec §4, §10). */
const GRANTABLE: Permission[] = [
  Permission.ImportLists,
  Permission.EditAreaTable,
  Permission.ResolveDuplicates,
  Permission.ConfirmAllocation,
];

function TemporaryPasswordDialog({
  result,
  onClose,
}: {
  result: TemporaryPasswordResponse | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  return (
    <Dialog
      open
      title="仮パスワード"
      onClose={onClose}
      footer={<Button onClick={onClose}>閉じる</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          {result.user.name}さん（{result.user.email}）の仮パスワードです。
          <b>この画面を閉じると二度と表示されません。</b>
          安全な方法で本人に伝えてください。初回ログインで変更が必要です。
        </p>
        <div className="flex items-center gap-2 rounded-(--radius-control) bg-canvas px-3 py-2.5">
          <code className="flex-1 font-mono text-base break-all">{result.temporaryPassword}</code>
          <Button
            variant="secondary"
            icon={<Copy className="size-4" aria-hidden="true" />}
            onClick={() =>
              void navigator.clipboard
                .writeText(result.temporaryPassword)
                .then(() => setCopied(true))
            }
          >
            {copied ? 'コピーしました' : 'コピー'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function UserDialog({
  user,
  onClose,
  onCreated,
}: {
  user?: AdminUserDto;
  onClose: () => void;
  onCreated: (result: TemporaryPasswordResponse) => void;
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [values, setValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    employeeNo: user?.employeeNo ?? '',
    roles: user?.roles ?? ([] as Role[]),
    grants: user?.grants ?? ([] as Permission[]),
    status: user?.status ?? 'ACTIVE',
    isAllocationTarget: user?.telemarketer?.isAllocationTarget ?? true,
    territory: user?.telemarketer?.territory ?? ([] as string[]),
  });
  const error = create.error ?? update.error;
  const isTelema = values.roles.includes(Role.Telema) || values.roles.includes(Role.TelemaLead);
  const toggle = <T,>(list: T[], value: T, on: boolean) =>
    on ? [...list, value] : list.filter((item) => item !== value);

  const submit = () => {
    const base = {
      name: values.name,
      email: values.email,
      employeeNo: values.employeeNo || null,
      roles: values.roles,
    };
    if (user) {
      update.mutate(
        {
          id: user.id,
          request: {
            ...base,
            status: values.status,
            grants: values.grants,
            telemarketer: isTelema
              ? { isAllocationTarget: values.isAllocationTarget, territory: values.territory }
              : null,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(base, {
        onSuccess: (result) => {
          onCreated(result);
          onClose();
        },
      });
    }
  };

  return (
    <Dialog
      open
      size="lg"
      title={user ? 'ユーザーの編集' : 'ユーザーを追加'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            loading={create.isPending || update.isPending}
            disabled={!values.name.trim() || !values.email.trim() || values.roles.length === 0}
            onClick={submit}
          >
            {user ? '保存する' : '追加して仮パスワードを発行'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Alert tone="error">
            {(error as { details?: { reason?: string } }).details?.reason === 'last_admin'
              ? '有効な管理者が1人もいなくなるため、変更できません。'
              : errorMessageOf(error)}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="氏名" required>
            {(c) => (
              <TextInput
                {...c}
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="メールアドレス（ログインID）" required>
            {(c) => (
              <TextInput
                {...c}
                type="email"
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="社員番号">
            {(c) => (
              <TextInput
                {...c}
                value={values.employeeNo}
                onChange={(e) => setValues({ ...values, employeeNo: e.target.value })}
              />
            )}
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-bold">役割（複数可）</legend>
          <div className="flex flex-wrap gap-x-6">
            {ALL_ROLES.map((role) => (
              <Checkbox
                key={role}
                label={ja.role[role]}
                checked={values.roles.includes(role)}
                onChange={(e) =>
                  setValues({ ...values, roles: toggle(values.roles, role, e.target.checked) })
                }
              />
            ))}
          </div>
        </fieldset>
        {user && (
          <>
            <fieldset>
              <legend className="mb-1 text-sm font-bold">個別に許可する操作</legend>
              <div className="flex flex-wrap gap-x-6">
                {GRANTABLE.map((permission) => (
                  <Checkbox
                    key={permission}
                    label={ja.permission[permission]}
                    checked={values.grants.includes(permission)}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        grants: toggle(values.grants, permission, e.target.checked),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
            {isTelema && (
              <fieldset className="rounded-(--radius-control) border border-line p-3">
                <legend className="px-1 text-sm font-bold">テレマの設定（自動割り振り）</legend>
                <Checkbox
                  label="割り振りの対象にする"
                  checked={values.isAllocationTarget}
                  onChange={(e) => setValues({ ...values, isAllocationTarget: e.target.checked })}
                />
                <FormField
                  label="担当範囲（決まっている人のみ）"
                  hint="例：京都府・滋賀県・奈良県。ここに入れたエリアの企業は自動割り振りから外れます。"
                >
                  {(c) => (
                    <TextInput
                      {...c}
                      value={values.territory.join('、')}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          territory: e.target.value
                            .split(/[、,\s]+/)
                            .filter((name) => PREFECTURE_NAMES.includes(name)),
                        })
                      }
                    />
                  )}
                </FormField>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-1 text-sm font-bold">状態</legend>
              <div className="flex gap-6">
                <Checkbox
                  type="radio"
                  name="status"
                  label="有効"
                  checked={values.status === 'ACTIVE'}
                  onChange={() => setValues({ ...values, status: 'ACTIVE' })}
                />
                <Checkbox
                  type="radio"
                  name="status"
                  label="無効（退職・異動。削除はしません）"
                  checked={values.status === 'DISABLED'}
                  onChange={() => setValues({ ...values, status: 'DISABLED' })}
                />
              </div>
            </fieldset>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Users and roles (spec §4): leavers are disabled, never deleted. */
export function UsersPage() {
  const query = useAdminUsers();
  const reset = useResetPassword();
  const unlock = useUnlockUser();
  const [editing, setEditing] = useState<AdminUserDto | 'new' | null>(null);
  const [temporary, setTemporary] = useState<TemporaryPasswordResponse | null>(null);

  return (
    <>
      <Card
        title="ユーザー"
        actions={
          <Button
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setEditing('new')}
          >
            ユーザーを追加
          </Button>
        }
        flush
      >
        {(reset.isError || unlock.isError) && (
          <Alert tone="error" className="m-4">
            {errorMessageOf(reset.error ?? unlock.error)}
          </Alert>
        )}
        <QueryState query={query}>
          {(users) => (
            <Table>
              <thead>
                <tr>
                  <Th>氏名</Th>
                  <Th className="max-md:hidden">メールアドレス</Th>
                  <Th>役割</Th>
                  <Th className="max-lg:hidden">最終ログイン</Th>
                  <Th>状態</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={user.status === 'DISABLED' ? 'text-ink-sub' : undefined}
                  >
                    <Td>
                      <span className="font-bold">{user.name}</span>
                      {user.employeeNo && (
                        <div className="text-xs text-ink-sub">社員番号 {user.employeeNo}</div>
                      )}
                    </Td>
                    <Td className="break-all max-md:hidden">{user.email}</Td>
                    <Td>
                      <RoleBadges roles={user.roles} />
                    </Td>
                    <Td className="whitespace-nowrap max-lg:hidden">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '―'}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        {user.status === 'ACTIVE' ? (
                          <Badge tone="success">有効</Badge>
                        ) : (
                          <Badge>無効</Badge>
                        )}
                        {user.isLocked && <Badge tone="danger">ロック中</Badge>}
                        {user.mustChangePassword && <Badge tone="warning">初回変更待ち</Badge>}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        {user.isLocked && (
                          <Button variant="text" onClick={() => unlock.mutate(user.id)}>
                            ロック解除
                          </Button>
                        )}
                        <Button
                          variant="text"
                          icon={<KeyRound className="size-4" aria-hidden="true" />}
                          onClick={() => reset.mutate(user.id, { onSuccess: setTemporary })}
                        >
                          仮パスワード
                        </Button>
                        <Button variant="secondary" onClick={() => setEditing(user)}>
                          編集
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryState>
      </Card>
      {editing && (
        <UserDialog
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onCreated={setTemporary}
        />
      )}
      <TemporaryPasswordDialog result={temporary} onClose={() => setTemporary(null)} />
    </>
  );
}
