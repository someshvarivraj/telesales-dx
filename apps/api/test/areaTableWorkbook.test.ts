import { describe, expect, it } from 'vitest';
import { AreaTableFormatError, AreaTableWorkbook } from '../src/domain/area/AreaTableWorkbook.js';

// Made-up rows in the workbook's layout; no real names or areas from the file.
const AREA_HEADER = [
  'No\nNo',
  '都道府県\nPrefecture',
  '市区町村\nCity / ward',
  '取引区分の条件\nCustomer type',
  '企業の条件\nCompany condition',
  '担当営業（資料の表記）\nRep (as on sheet)',
  '担当営業（氏名）\nRep (full name)',
  '訪問形態\nVisit / Web',
];
const FOCUS_HEADER = ['No\nNo', 'エリア\nArea', '企業名\nCompany', '担当営業\nRep'];

describe('AreaTableWorkbook', () => {
  it('maps customer type, visit form and company conditions onto rules', () => {
    const parsed = new AreaTableWorkbook().parse(
      [
        AREA_HEADER,
        ['1', '大阪府', '大阪市北区', '現取', '', '山田', '山田 太郎', '訪問可'],
        ['2', '大阪府', '大阪市北区', '現取以外', '', '佐藤', '佐藤　花子', 'WEBのみ'],
        ['3', '兵庫県', '神戸市中央区', 'すべて', 'テスト島以外', '山田', '', '訪問可'],
        ['4', '兵庫県', '神戸市中央区', 'すべて', 'テスト島', '佐藤', '', '訪問可'],
        ['', '', '', '', '', '', '', ''],
      ],
      null,
    );
    expect(parsed.rules).toHaveLength(4);
    expect(parsed.rules[0]).toMatchObject({
      prefecture: '大阪府',
      city: '大阪市北区',
      customerTypeCondition: 'CURRENT',
      groupName: null,
      repName: '山田 太郎',
      webOnly: false,
    });
    // Full-width space in the name becomes a normal one; WEBのみ → web only.
    expect(parsed.rules[1]).toMatchObject({
      customerTypeCondition: 'NOT_CURRENT',
      repName: '佐藤 花子',
      webOnly: true,
    });
    // 「○○以外」 is the area's normal rep; 「○○」 becomes a group with its own rep.
    expect(parsed.rules[2]).toMatchObject({ groupName: null, repName: '山田 太郎' });
    expect(parsed.rules[3]).toMatchObject({ groupName: 'テスト島', repName: '佐藤 花子' });
    expect(parsed.groups).toEqual([{ name: 'テスト島', members: [] }]);
    expect(parsed.reps).toEqual(['山田 太郎', '佐藤 花子']);
  });

  it('uses given full names for reps the sheet names only briefly, and drops （？）', () => {
    const parsed = new AreaTableWorkbook(new Map([['鈴木', '鈴木　一郎']])).parse(
      [
        AREA_HEADER,
        ['1', '京都府', '', 'すべて', '', '鈴木', '', '訪問可'],
        ['2', '京都府', '', 'すべて', '', '高橋', '高橋 次郎（？）', '訪問可'],
      ],
      null,
    );
    expect(parsed.rules.map((rule) => rule.repName)).toEqual(['鈴木 一郎', '高橋 次郎']);
  });

  it('turns the focus companies into one group per area and rep', () => {
    const parsed = new AreaTableWorkbook().parse(
      [AREA_HEADER, ['1', '京都府', '', '現取', '', '山田', '山田 太郎', '訪問可']],
      [
        FOCUS_HEADER,
        ['1', '京都・滋賀', 'テストA', '山田太郎'],
        ['2', '京都・滋賀', 'テストB', '山田 太郎'],
        ['3', '京都・滋賀', 'テストC', '佐藤花子'],
      ],
    );
    expect(parsed.groups).toEqual([
      { name: '注力企業（京都・滋賀）・山田 太郎', members: ['テストA', 'テストB'] },
      { name: '注力企業（京都・滋賀）・佐藤花子', members: ['テストC'] },
    ]);
    const focusRules = parsed.rules.filter((rule) => rule.groupName?.startsWith('注力企業'));
    expect(focusRules).toMatchObject([
      { prefecture: '京都府', customerTypeCondition: null, repName: '山田 太郎' },
      { prefecture: '京都府', customerTypeCondition: null, repName: '佐藤花子' },
    ]);
    // 「山田太郎」 on the focus sheet is the same person as 「山田 太郎」.
    expect(parsed.reps).toEqual(['山田 太郎', '佐藤花子']);
  });

  it('stops on values it does not know instead of guessing', () => {
    const workbook = new AreaTableWorkbook();
    expect(() =>
      workbook.parse(
        [AREA_HEADER, ['1', '大阪府', '', '一部', '', '山田', '山田 太郎', '訪問可']],
        null,
      ),
    ).toThrow(AreaTableFormatError);
    expect(() =>
      workbook.parse([AREA_HEADER, ['1', '大阪府', '', 'すべて', '', '山田', '', '訪問可']], null),
    ).toThrow(/フルネーム/);
  });
});
