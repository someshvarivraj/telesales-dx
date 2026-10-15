import { PREFECTURE_NAMES } from '@telesales/shared';

/**
 * Reads the checked sales area table workbook (営業担当表・確認済分) into rules the app
 * stores. The workbook has one row per area on the sheet 「営業担当表」 and the companies
 * with a fixed rep on 「注力企業」. Only cell text comes in, so this class has no I/O and
 * the file's contents never live in code.
 */

/** Cell text of one sheet; the first row is the header. */
export type SheetRows = readonly (readonly string[])[];

export interface ParsedRule {
  /** Row number on the sheet, for messages. */
  row: number;
  prefecture: string;
  city: string | null;
  customerTypeCondition: 'CURRENT' | 'NOT_CURRENT' | null;
  /** Name of the company group the rule is for (e.g. 「ポートアイランド」), if any. */
  groupName: string | null;
  repName: string;
  webOnly: boolean;
}

export interface ParsedGroup {
  name: string;
  members: string[];
}

export interface ParsedAreaTable {
  rules: ParsedRule[];
  groups: ParsedGroup[];
  /** Full names of every rep, in order of first appearance. */
  reps: string[];
}

export class AreaTableFormatError extends Error {}

const AREA_SHEET = {
  prefecture: '都道府県',
  city: '市区町村',
  customerType: '取引区分の条件',
  companyCondition: '企業の条件',
  repLabel: '担当営業（資料の表記）',
  repName: '担当営業（氏名）',
  visit: '訪問形態',
} as const;

const FOCUS_SHEET = {
  area: 'エリア',
  company: '企業名',
  rep: '担当営業',
} as const;

const CUSTOMER_TYPE: Record<string, ParsedRule['customerTypeCondition']> = {
  すべて: null,
  現取: 'CURRENT',
  現取以外: 'NOT_CURRENT',
};

const VISIT: Record<string, boolean> = { 訪問可: false, WEBのみ: true };

/** 「京都・滋賀・奈良」→ 京都府 (a group rule needs one prefecture; it applies anywhere). */
function firstPrefecture(area: string): string {
  const head = area.split(/[・、,]/)[0]?.trim() ?? '';
  const match = PREFECTURE_NAMES.find((name) => name === head || name.startsWith(head));
  if (!match) throw new AreaTableFormatError(`エリア「${area}」の都道府県が分かりません。`);
  return match;
}

/** Same person however the name is spaced: 「小林貴也」「小林 貴也」「小林　貴也」. */
function personKey(name: string): string {
  return name.normalize('NFKC').replace(/\s/g, '');
}

/** 「小林 大和（？）」→「小林 大和」, full-width space → half-width. */
function cleanName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[（(][?？][)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class Header {
  private readonly index = new Map<string, number>();

  constructor(
    cells: readonly string[],
    private readonly sheet: string,
  ) {
    cells.forEach((cell, i) => {
      // Headers are 「日本語\nEnglish」; the Japanese line is the key.
      const key = cell.split('\n')[0]?.trim();
      if (key) this.index.set(key, i);
    });
  }

  get(row: readonly string[], column: string): string {
    const i = this.index.get(column);
    if (i === undefined) {
      throw new AreaTableFormatError(`シート「${this.sheet}」に列「${column}」がありません。`);
    }
    return (row[i] ?? '').trim();
  }
}

export class AreaTableWorkbook {
  /**
   * @param repNames full names for reps the sheet gives only by short name
   *   (e.g. 「中島」→「中島 慎之亮」), from the answers to the questions sheet.
   */
  constructor(private readonly repNames: ReadonlyMap<string, string> = new Map()) {}

  parse(areaSheet: SheetRows, focusSheet: SheetRows | null): ParsedAreaTable {
    const reps = new Map<string, string>();
    const remember = (name: string) => {
      const key = personKey(name);
      if (!reps.has(key)) reps.set(key, name);
      return reps.get(key) ?? name;
    };

    const rules = this.parseAreas(areaSheet).map((rule) => ({
      ...rule,
      repName: remember(rule.repName),
    }));
    const groups: ParsedGroup[] = [];
    for (const rule of rules) {
      if (rule.groupName && !groups.some((group) => group.name === rule.groupName)) {
        groups.push({ name: rule.groupName, members: [] });
      }
    }

    if (focusSheet) {
      const focus = this.parseFocus(focusSheet, (name) => remember(name));
      rules.push(...focus.rules);
      groups.push(...focus.groups);
    }
    return { rules, groups, reps: [...reps.values()] };
  }

  private parseAreas(sheet: SheetRows): ParsedRule[] {
    const [head, ...body] = sheet;
    if (!head) throw new AreaTableFormatError('シート「営業担当表」が空です。');
    const header = new Header(head, '営業担当表');
    const shortToFull = this.shortNameMap(header, body);

    return body
      .map((cells, i) => ({ cells, row: i + 2 }))
      .filter(({ cells }) => header.get(cells, AREA_SHEET.prefecture) !== '')
      .map(({ cells, row }) => {
        const at = (column: string) => header.get(cells, column);
        const prefecture = at(AREA_SHEET.prefecture);
        if (!(PREFECTURE_NAMES as readonly string[]).includes(prefecture)) {
          throw new AreaTableFormatError(`${row}行目：都道府県「${prefecture}」が分かりません。`);
        }
        const customerType = at(AREA_SHEET.customerType) || 'すべて';
        if (!(customerType in CUSTOMER_TYPE)) {
          throw new AreaTableFormatError(
            `${row}行目：取引区分の条件「${customerType}」が分かりません。`,
          );
        }
        const visit = at(AREA_SHEET.visit) || '訪問可';
        if (!(visit in VISIT)) {
          throw new AreaTableFormatError(`${row}行目：訪問形態「${visit}」が分かりません。`);
        }
        const condition = at(AREA_SHEET.companyCondition);
        const repName = this.repOf(at(AREA_SHEET.repName), at(AREA_SHEET.repLabel), shortToFull);
        if (!repName) {
          throw new AreaTableFormatError(
            `${row}行目：担当営業「${at(AREA_SHEET.repLabel)}」のフルネームがありません。`,
          );
        }
        return {
          row,
          prefecture,
          city: at(AREA_SHEET.city) || null,
          customerTypeCondition: CUSTOMER_TYPE[customerType] ?? null,
          // 「○○以外」 is the area's normal rep; 「○○」 is the group with its own rep.
          groupName: condition && !condition.endsWith('以外') ? condition : null,
          repName,
          webOnly: VISIT[visit] ?? false,
        };
      });
  }

  /** Short name on the sheet → full name, from rows that have both and from `repNames`. */
  private shortNameMap(header: Header, body: SheetRows): Map<string, string> {
    const map = new Map<string, string>();
    for (const [short, full] of this.repNames) map.set(personKey(short), cleanName(full));
    for (const cells of body) {
      const short = header.get(cells, AREA_SHEET.repLabel);
      const full = header.get(cells, AREA_SHEET.repName);
      if (short && full && !map.has(personKey(short))) map.set(personKey(short), cleanName(full));
    }
    return map;
  }

  private repOf(full: string, short: string, shortToFull: Map<string, string>): string | null {
    if (full) return cleanName(full);
    return shortToFull.get(personKey(short)) ?? null;
  }

  /**
   * 注力企業: one group per area and rep (most companies share a rep), with a rule that
   * gives that rep the group whatever the customer type.
   */
  private parseFocus(
    sheet: SheetRows,
    rep: (name: string) => string,
  ): { rules: ParsedRule[]; groups: ParsedGroup[] } {
    const [head, ...body] = sheet;
    if (!head) return { rules: [], groups: [] };
    const header = new Header(head, '注力企業');
    const byGroup = new Map<
      string,
      { area: string; rep: string; members: string[]; row: number }
    >();
    body.forEach((cells, i) => {
      const company = header.get(cells, FOCUS_SHEET.company);
      if (!company) return;
      const area = header.get(cells, FOCUS_SHEET.area);
      const repName = rep(cleanName(header.get(cells, FOCUS_SHEET.rep)));
      const key = `${area}\u0000${personKey(repName)}`;
      const entry = byGroup.get(key) ?? { area, rep: repName, members: [], row: i + 2 };
      entry.members.push(company);
      byGroup.set(key, entry);
    });

    const entries = [...byGroup.values()];
    const groups: ParsedGroup[] = [];
    const rules: ParsedRule[] = [];
    for (const entry of entries) {
      const sameArea = entries.filter((other) => other.area === entry.area).length;
      const name =
        sameArea > 1 ? `注力企業（${entry.area}）・${entry.rep}` : `注力企業（${entry.area}）`;
      groups.push({ name, members: entry.members });
      rules.push({
        row: entry.row,
        prefecture: firstPrefecture(entry.area),
        city: null,
        customerTypeCondition: null,
        groupName: name,
        repName: entry.rep,
        webOnly: false,
      });
    }
    return { rules, groups };
  }
}
