/**
 * Loads the checked sales area table workbook (営業担当表・確認済分) into the app:
 * the area rules, the company groups (注力企業 and company conditions such as
 * 「ポートアイランド」) and a sales account for every rep named in it.
 *
 *   pnpm area:import --file ~/Downloads/営業担当表（確認済分）_10-15.xlsx \
 *     --rep-name "中島=中島 慎之亮" --rep-name "白鳥=白鳥 大輔" --replace
 *
 * --rep-name   Full name for a rep the sheet names only briefly (repeatable).
 * --valid-from First day the rules apply (YYYY-MM-DD, default: today in JST).
 * --replace    Required: the current rules are replaced by the file's.
 * --dry-run    Read and check the file, change nothing.
 *
 * Reps without an account get an active 営業 account with a placeholder address
 * (…@pending.invalid, which cannot receive mail) and no password anyone knows. An admin
 * sets the real address and issues a password on the ユーザー screen.
 */
import { parseArgs } from 'node:util';
import { APP_KEY, jstDate, Role } from '@telesales/shared';
import ExcelJS from 'exceljs';
import { AppConfig } from '../config/AppConfig.js';
import { Container } from '../container.js';
import { AuditAction } from '../domain/audit/AuditLogger.js';
import { AreaTableWorkbook, type SheetRows } from '../domain/area/AreaTableWorkbook.js';
import { normalizeCompanyName } from '../domain/companies/duplicates.js';

const USAGE =
  'Usage: --file <xlsx> [--rep-name "短い名前=フルネーム" ...] [--valid-from YYYY-MM-DD] (--replace | --dry-run)';
const PLACEHOLDER_DOMAIN = 'pending.invalid';

/** Cell text of every row of a sheet (null if the sheet is missing). */
function rowsOf(workbook: ExcelJS.Workbook, name: string): SheetRows | null {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return null;
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      cells.push(row.getCell(column).text);
    }
    rows.push(cells);
  });
  return rows;
}

function personKey(name: string): string {
  return name.normalize('NFKC').replace(/\s/g, '');
}

async function run(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'rep-name': { type: 'string', multiple: true },
      'valid-from': { type: 'string' },
      replace: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.file || values.replace === values['dry-run']) throw new Error(USAGE);

  const repNames = new Map<string, string>();
  for (const pair of values['rep-name'] ?? []) {
    const [short, full] = pair.split('=').map((part) => part.trim());
    if (!short || !full) throw new Error(`--rep-name must be 短い名前=フルネーム: ${pair}`);
    repNames.set(short, full);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(values.file);
  const areaSheet = rowsOf(workbook, '営業担当表');
  if (!areaSheet) throw new Error('シート「営業担当表」がありません。');
  const table = new AreaTableWorkbook(repNames).parse(areaSheet, rowsOf(workbook, '注力企業'));

  const container = new Container(AppConfig.fromEnv());
  const prisma = container.database.client;
  try {
    const validFrom = values['valid-from'] ?? jstDate(container.clock.now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) throw new Error(USAGE);

    // Reps: existing accounts are matched by name, however the name is spaced.
    const people = await prisma.user.findMany({ select: { id: true, name: true } });
    const idByName = new Map(people.map((person) => [personKey(person.name), person.id]));
    const missing = table.reps.filter((name) => !idByName.has(personKey(name)));

    process.stdout.write(
      [
        `Rules: ${table.rules.length}  Groups: ${table.groups.length}  Reps: ${table.reps.length} (${missing.length} new)`,
        `Valid from: ${validFrom}`,
        '',
      ].join('\n'),
    );
    if (values['dry-run']) return;

    let next = 1;
    const placeholder = async () => {
      for (;;) {
        const email = `sales-rep-${String(next++).padStart(2, '0')}@${PLACEHOLDER_DOMAIN}`;
        if (!(await container.users.findByEmail(email))) return email;
      }
    };
    for (const name of missing) {
      // The temporary password is thrown away: nobody can sign in until an admin
      // sets the real address and issues a new password.
      const { user } = await container.userService.createUser({
        email: await placeholder(),
        name,
        employeeNo: null,
        roles: [Role.Sales],
      });
      idByName.set(personKey(name), user.id);
    }

    await prisma.$transaction(async (tx) => {
      await tx.salesAreaRule.deleteMany({});
      const groupIds = new Map<string, string>();
      for (const group of table.groups) {
        const row = await tx.companyGroup.upsert({
          where: { name: group.name },
          create: { name: group.name, isActive: true },
          update: { isActive: true },
        });
        groupIds.set(group.name, row.id);
        await tx.companyGroupMember.deleteMany({ where: { groupId: row.id } });
        const seen = new Set<string>();
        await tx.companyGroupMember.createMany({
          data: group.members
            .map((name) => ({ name, nameKey: normalizeCompanyName(name), groupId: row.id }))
            .filter(
              (member) => member.nameKey && !seen.has(member.nameKey) && seen.add(member.nameKey),
            ),
        });
      }
      await tx.salesAreaRule.createMany({
        data: table.rules.map((rule) => {
          const salesRepId = idByName.get(personKey(rule.repName));
          if (!salesRepId) throw new Error(`No account for ${rule.repName}`);
          return {
            prefecture: rule.prefecture,
            city: rule.city,
            customerTypeCondition: rule.customerTypeCondition,
            companyGroupId: rule.groupName ? (groupIds.get(rule.groupName) ?? null) : null,
            salesRepId,
            webOnly: rule.webOnly,
            validFrom: new Date(`${validFrom}T00:00:00Z`),
          };
        }),
      });
    });

    await container.audit.record({
      action: AuditAction.SettingsChanged,
      actorUserId: null,
      targetType: 'sales_area_rule',
      after: {
        source: 'area table workbook',
        rules: table.rules.length,
        groups: table.groups.length,
        newReps: missing.length,
        validFrom,
      },
    });

    const sales = await prisma.user.count({
      where: { roles: { some: { appKey: APP_KEY, role: Role.Sales } } },
    });
    process.stdout.write(
      `Done. ${missing.length} sales account(s) created with ${PLACEHOLDER_DOMAIN} addresses; ${sales} sales accounts in total.\n`,
    );
  } finally {
    await container.dispose();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
