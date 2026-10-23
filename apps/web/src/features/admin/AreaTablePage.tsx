import {
  type AreaRuleDto,
  type AreaRuleRequest,
  type CompanyGroupDto,
  PREFECTURE_NAMES,
  Role,
} from '@telesales/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
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
import { StatusLabel } from '@/components/ui/StatusLabel';
import { Table, Td, Th } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
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
              <DatePicker
                {...c}
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
              <DatePicker
                {...c}
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

/**
 * A company group: a name and the companies in it, one per line. Companies match on the
 * normalised name (株式会社 etc. and spaces ignored), so later imports pick it up too.
 */
function GroupDialog({ group, onClose }: { group?: CompanyGroupDto; onClose: () => void }) {
  const save = useSaveCompanyGroup();
  const [name, setName] = useState(group?.name ?? '');
  const [isActive, setIsActive] = useState(group?.isActive ?? true);
  const [members, setMembers] = useState((group?.members ?? []).join('\n'));
  const names = members
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <Dialog
      open
      title={group ? '企業グループの変更' : '企業グループを追加'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() =>
              save.mutate(
                { id: group?.id, request: { name: name.trim(), isActive, members: names } },
                { onSuccess: onClose },
              )
            }
          >
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {save.isError && <Alert tone="error">{errorMessageOf(save.error)}</Alert>}
        <FormField label="グループ名" required>
          {(c) => <TextInput {...c} value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField
          label={`対象の企業（${names.length}社）`}
          hint="1行に1社。「株式会社」などや空白の違いは同じ会社として扱います。"
        >
          {(c) => (
            <Textarea
              {...c}
              rows={10}
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          )}
        </FormField>
        <Checkbox
          label="このグループを使う"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/** The sales area table (spec §5, §7), kept as data and edited on screen. */
export function AreaTablePage() {
  const rules = useAreaRules();
  const groups = useCompanyGroups();
  const [editing, setEditing] = useState<AreaRuleDto | 'new' | null>(null);
  const [editingGroup, setEditingGroup] = useState<CompanyGroupDto | 'new' | null>(null);
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
                              <Badge tone="info">{rule.companyGroup.name}</Badge>
                            )}
                            {rule.webOnly && <Badge tone="info">Webのみ</Badge>}
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

      <Card
        title="企業グループ"
        actions={
          <Button variant="secondary" onClick={() => setEditingGroup('new')}>
            グループを追加
          </Button>
        }
        flush
      >
        <QueryState query={groups}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState>
                特定の企業だけ担当が違うとき（注力企業など）に、グループを作って担当を決めます。
              </EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>グループ名</Th>
                    <Th>対象の企業</Th>
                    <Th>状態</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((group) => (
                    <tr key={group.id} className={group.isActive ? undefined : 'text-ink-sub'}>
                      <Td className="font-bold">{group.name}</Td>
                      <Td>
                        <span className="tabular-nums">{group.members.length}社</span>
                        {group.members.length > 0 && (
                          <span className="ml-2 text-xs text-ink-sub max-md:hidden">
                            {group.members.slice(0, 3).join('、')}
                            {group.members.length > 3 ? ' ほか' : ''}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <StatusLabel tone={group.isActive ? 'success' : 'neutral'}>
                          {group.isActive ? '使用中' : '使わない'}
                        </StatusLabel>
                      </Td>
                      <Td>
                        <Button variant="secondary" onClick={() => setEditingGroup(group)}>
                          編集
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )
          }
        </QueryState>
      </Card>
      {editingGroup && (
        <GroupDialog
          group={editingGroup === 'new' ? undefined : editingGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}
      {editing && (
        <RuleDialog
          rule={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
