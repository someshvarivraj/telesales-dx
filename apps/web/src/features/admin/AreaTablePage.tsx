import { type AreaRuleDto, type AreaRuleRequest, PREFECTURE_NAMES, Role } from '@telesales/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { usePeople } from '@/features/reference/useReference';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, todayJst } from '@/lib/format';
import {
  useAreaRules,
  useCompanyGroups,
  useDeleteAreaRule,
  useSaveAreaRule,
  useSaveCompanyGroup,
} from './api';

const CONDITIONS = [
  { value: '', label: '条件なし' },
  { value: 'CURRENT', label: '現取のみ' },
  { value: 'NOT_CURRENT', label: '現取以外' },
];

function RuleDialog({ rule, onClose }: { rule?: AreaRuleDto; onClose: () => void }) {
  const save = useSaveAreaRule();
  const remove = useDeleteAreaRule();
  const reps = usePeople(Role.Sales);
  const groups = useCompanyGroups();
  const [values, setValues] = useState({
    prefecture: rule?.prefecture ?? '',
    city: rule?.city ?? '',
    customerTypeCondition: rule?.customerTypeCondition ?? '',
    companyGroupId: rule?.companyGroup?.id ?? '',
    salesRepId: rule?.salesRep.id ?? '',
    backupRepId: rule?.backupRep?.id ?? '',
    webOnly: rule?.webOnly ?? false,
    validFrom: rule?.validFrom ?? todayJst(),
    validTo: rule?.validTo ?? '',
  });
  const repOptions = (reps.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const submit = () => {
    const request: AreaRuleRequest = {
      prefecture: values.prefecture,
      city: values.city || null,
      customerTypeCondition: (values.customerTypeCondition ||
        null) as AreaRuleRequest['customerTypeCondition'],
      companyGroupId: values.companyGroupId || null,
      salesRepId: values.salesRepId,
      backupRepId: values.backupRepId || null,
      webOnly: values.webOnly,
      validFrom: values.validFrom,
      validTo: values.validTo || null,
    };
    save.mutate({ id: rule?.id, request }, { onSuccess: onClose });
  };
  return (
    <Dialog
      open
      size="lg"
      title={rule ? '担当の変更' : '担当を追加'}
      onClose={onClose}
      footer={
        <>
          {rule && (
            <Button
              variant="text"
              loading={remove.isPending}
              onClick={() => remove.mutate(rule.id, { onSuccess: onClose })}
            >
              削除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            loading={save.isPending}
            disabled={!values.prefecture || !values.salesRepId || !values.validFrom}
            onClick={submit}
          >
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {(save.isError || remove.isError) && (
          <Alert tone="error">{errorMessageOf(save.error ?? remove.error)}</Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="都道府県" required>
            {(c) => (
              <Select
                {...c}
                value={values.prefecture}
                placeholder="選択してください"
                options={PREFECTURE_NAMES.map((name) => ({ value: name, label: name }))}
                onChange={(e) => setValues({ ...values, prefecture: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="市区町村" hint="空のときは都道府県全体。">
            {(c) => (
              <TextInput
                {...c}
                value={values.city}
                onChange={(e) => setValues({ ...values, city: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="取引区分の条件">
            {(c) => (
              <Select
                {...c}
                value={values.customerTypeCondition}
                options={CONDITIONS}
                onChange={(e) => setValues({ ...values, customerTypeCondition: e.target.value })}
              />
            )}
          </FormField>
          <FormField
            label="企業グループ"
            hint="特定のグループ企業はエリアに関係なくこの担当になります。"
          >
            {(c) => (
              <Select
                {...c}
                value={values.companyGroupId}
                placeholder="なし"
                options={(groups.data ?? [])
                  .filter((g) => g.isActive)
                  .map((g) => ({ value: g.id, label: g.name }))}
                onChange={(e) => setValues({ ...values, companyGroupId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="担当営業" required>
            {(c) => (
              <Select
                {...c}
                value={values.salesRepId}
                placeholder="選択してください"
                options={repOptions}
                onChange={(e) => setValues({ ...values, salesRepId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="代わりの人">
            {(c) => (
              <Select
                {...c}
                value={values.backupRepId}
                placeholder="なし"
                options={repOptions}
                onChange={(e) => setValues({ ...values, backupRepId: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="いつから" required>
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={values.validFrom}
                onChange={(e) => setValues({ ...values, validFrom: e.target.value })}
              />
            )}
          </FormField>
          <FormField
            label="いつまで"
            hint="担当が変わるときは、終わりの日を入れて新しい行を足します。"
          >
            {(c) => (
              <TextInput
                {...c}
                type="date"
                value={values.validTo}
                onChange={(e) => setValues({ ...values, validTo: e.target.value })}
              />
            )}
          </FormField>
        </div>
        <Checkbox
          label="Webのみのエリア（訪問形態の初期値をオンラインにする）"
          checked={values.webOnly}
          onChange={(e) => setValues({ ...values, webOnly: e.target.checked })}
        />
      </div>
    </Dialog>
  );
}

/** The sales area table (spec §5, §7), kept as data and edited on screen. */
export function AreaTablePage() {
  const rules = useAreaRules();
  const groups = useCompanyGroups();
  const saveGroup = useSaveCompanyGroup();
  const [editing, setEditing] = useState<AreaRuleDto | 'new' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [filter, setFilter] = useState('');
  const today = todayJst();

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="営業担当表"
        actions={
          <>
            <div className="w-40">
              <Select
                aria-label="都道府県で絞り込み"
                value={filter}
                placeholder="すべての都道府県"
                options={PREFECTURE_NAMES.map((name) => ({ value: name, label: name }))}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <Button
              icon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setEditing('new')}
            >
              担当を追加
            </Button>
          </>
        }
        flush
      >
        <QueryState query={rules}>
          {(items) => {
            const shown = items.filter((rule) => !filter || rule.prefecture === filter);
            return shown.length === 0 ? (
              <EmptyState>
                まだ登録がありません。元の表（Excel / CSV）があれば、行ごとに追加してください。
              </EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>エリア</Th>
                    <Th>条件</Th>
                    <Th>担当営業</Th>
                    <Th className="max-md:hidden">代わり</Th>
                    <Th className="max-lg:hidden">期間</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((rule) => {
                    const active =
                      rule.validFrom <= today && (!rule.validTo || rule.validTo >= today);
                    return (
                      <tr key={rule.id} className={active ? undefined : 'text-ink-sub'}>
                        <Td>
                          {rule.prefecture} {rule.city}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {rule.customerTypeCondition && (
                              <Badge tone="outline">
                                {
                                  CONDITIONS.find((c) => c.value === rule.customerTypeCondition)
                                    ?.label
                                }
                              </Badge>
                            )}
                            {rule.companyGroup && (
                              <Badge tone="main">{rule.companyGroup.name}</Badge>
                            )}
                            {rule.webOnly && <Badge tone="main">Webのみ</Badge>}
                          </div>
                        </Td>
                        <Td className="font-bold">{rule.salesRep.name}</Td>
                        <Td className="max-md:hidden">{rule.backupRep?.name}</Td>
                        <Td className="whitespace-nowrap max-lg:hidden">
                          {formatDate(rule.validFrom)}〜
                          {rule.validTo ? formatDate(rule.validTo) : ''}
                          {!active && '（期間外）'}
                        </Td>
                        <Td>
                          <Button variant="secondary" onClick={() => setEditing(rule)}>
                            編集
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            );
          }}
        </QueryState>
      </Card>

      <Card title="企業グループ">
        <div className="flex flex-col gap-3">
          {saveGroup.isError && <Alert tone="error">{errorMessageOf(saveGroup.error)}</Alert>}
          <div className="flex flex-wrap gap-2">
            {(groups.data ?? []).map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() =>
                  saveGroup.mutate({
                    id: group.id,
                    request: { name: group.name, isActive: !group.isActive },
                  })
                }
                className="cursor-pointer"
                title={group.isActive ? 'クリックで無効にする' : 'クリックで有効にする'}
              >
                <Badge tone={group.isActive ? 'main' : 'neutral'}>
                  {group.name}
                  {group.isActive ? '' : '（無効）'}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex max-w-md gap-2">
            <TextInput
              aria-label="グループ名"
              placeholder="グループ名"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!groupName.trim()}
              loading={saveGroup.isPending}
              onClick={() =>
                saveGroup.mutate(
                  { request: { name: groupName.trim(), isActive: true } },
                  { onSuccess: () => setGroupName('') },
                )
              }
            >
              追加
            </Button>
          </div>
        </div>
      </Card>
      {editing && (
        <RuleDialog
          rule={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
