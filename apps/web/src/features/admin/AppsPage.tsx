import type { AppDto } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useApps, useCreateApp, useUpdateApp } from './api';

/**
 * Apps that share the company-wide accounts, and maintenance mode (spec §6, priority 2).
 * While an app is in maintenance only admins can use it.
 */
export function AppsPage() {
  const query = useApps();
  const update = useUpdateApp();
  const [switching, setSwitching] = useState<AppDto | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {update.isError && <Alert tone="error">{errorMessageOf(update.error)}</Alert>}
      <QueryState query={query}>
        {(apps) => (
          <Card title="アプリ" flush>
            <Table>
              <thead>
                <tr>
                  <Th>名前</Th>
                  <Th>キー</Th>
                  <Th>状態</Th>
                  <Th>
                    <span className="sr-only">操作</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.key}>
                    <Td className="font-medium">
                      {app.name}
                      {app.current && (
                        <span className="ml-2 text-sm text-ink-sub">（このアプリ）</span>
                      )}
                    </Td>
                    <Td className="font-mono text-sm">{app.key}</Td>
                    <Td>
                      {app.maintenanceMode ? (
                        <Badge tone="warning">メンテナンス中</Badge>
                      ) : (
                        <Badge tone="success">利用中</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant={app.maintenanceMode ? 'primary' : 'secondary'}
                        onClick={() => setSwitching(app)}
                      >
                        {app.maintenanceMode ? 'メンテナンスを終える' : 'メンテナンスにする'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </QueryState>
      <AddApp />

      <Dialog
        open={switching !== null}
        onClose={() => setSwitching(null)}
        title={
          switching?.maintenanceMode ? 'メンテナンスを終えますか？' : 'メンテナンスにしますか？'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setSwitching(null)}>
              キャンセル
            </Button>
            <Button
              loading={update.isPending}
              onClick={() =>
                switching &&
                update.mutate(
                  {
                    key: switching.key,
                    request: { name: switching.name, maintenanceMode: !switching.maintenanceMode },
                  },
                  { onSettled: () => setSwitching(null) },
                )
              }
            >
              {switching?.maintenanceMode ? '終える' : 'メンテナンスにする'}
            </Button>
          </>
        }
      >
        <p>
          {switching?.maintenanceMode
            ? '全員がまた使えるようになります。'
            : `「${switching?.name}」は管理者だけが使えるようになり、ほかの人には「メンテナンス中」と表示されます。`}
        </p>
      </Dialog>
    </div>
  );
}

function AddApp() {
  const create = useCreateApp();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const valid = /^[a-z][a-z0-9_-]{1,31}$/.test(key) && name.trim() !== '';
  return (
    <Card title="アプリを追加">
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="text-sm text-ink-sub">
          同じアカウントで使う別のアプリを登録します。役割と権限はアプリごとに付けます。
        </p>
        {create.isError && <Alert tone="error">{errorMessageOf(create.error)}</Alert>}
        {create.isSuccess && <Alert tone="success">追加しました。</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="キー" hint="半角の英小文字・数字（例：skillsheet）">
            {(c) => (
              <TextInput
                {...c}
                value={key}
                maxLength={32}
                onChange={(e) => setKey(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="名前">
            {(c) => (
              <TextInput
                {...c}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div>
          <Button
            disabled={!valid}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { key, name: name.trim() },
                {
                  onSuccess: () => {
                    setKey('');
                    setName('');
                  },
                },
              )
            }
          >
            追加する
          </Button>
        </div>
      </div>
    </Card>
  );
}
