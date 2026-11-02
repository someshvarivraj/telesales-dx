import {
  cleanListRow,
  fixCompanyName,
  fixPhone,
  isSArea,
  isUnknownPhone,
  splitCompanyRank,
  splitRankCell,
  validateListRow,
} from '@telesales/shared';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { fieldForHeader, splitHeaderCell } from '../src/modules/companies/listColumns.js';
import { readTableFile } from '../src/modules/companies/TableFileReader.js';

/** The Telema team's template: a file-name note in row 1, headers with instructions in row 2. */
async function telemaTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('テレマリストCSV');
  sheet.addRow(['　ファイル名（例） ： 1業界地図～～～○○２４０３０５']);
  sheet.addRow([
    '　　　　業種',
    '　　　会社名\n・(株)ではなく株式会社\n・株式会社と会社名の間に、スペースなし\n',
    '　電話番号\n・半角と-で\n(文字()スペース → 不可)',
    '※入力不要郵便番号\n',
    '　住所1\n※列幅を変更しない\n・都道府県名必須',
    '　住所2\n※列幅を変更しない',
    '　住所3\n※列幅を変更しない\n・企業ランク必須\n上場/上系(親会社など)/優良\n/非上場',
    '※入力不要\n最寄駅\n',
    '　URL\n・不明時は-',
    '引用先URL',
  ]);
  sheet.addRow([
    '機械',
    '鈴茂器工株式会社',
    '03-3993-1371',
    null,
    '東京都中野区中野4-10-1',
    '中野セントラルパークイースト6Ｆ',
    '上系島津製作所',
    null,
    'http://www.suzumo.co.jp/',
    'https://example.com/source',
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('reading the Telema list template (Sano 10/28 ②)', () => {
  it('finds the headers in row 2 and reads names without the instructions', async () => {
    const table = await readTableFile('list.xlsx', await telemaTemplate());
    expect(table.headerRow).toBe(2);
    expect(table.headers).toEqual([
      '業種',
      '会社名',
      '電話番号',
      '郵便番号',
      '住所1',
      '住所2',
      '住所3',
      '最寄駅',
      'URL',
      '引用先URL',
    ]);
    expect(table.rows[0]?.row).toBe(3);
    expect(table.rows[0]?.values['会社名']).toBe('鈴茂器工株式会社');
  });

  it('maps 住所1/住所2, 「住所3」 as 企業ランク and 引用先URL as 掲載元のURL', async () => {
    const table = await readTableFile('list.xlsx', await telemaTemplate());
    const fields = table.headers.map((header) => fieldForHeader(header, table.notes[header]));
    expect(fields).toEqual([
      'industry',
      'name',
      'phone',
      null,
      'address',
      'address2',
      'companyRank',
      'nearestStation',
      'url',
      'sourceUrl',
    ]);
  });

  it('keeps an ordinary header row 1 working', () => {
    expect(splitHeaderCell('会社名')).toEqual({ header: '会社名', note: '' });
    expect(splitHeaderCell('※入力不要\n最寄駅\n').header).toBe('最寄駅');
  });
});

describe('automatic fixes', () => {
  it('writes 株式会社 in full with no space before the name', () => {
    expect(fixCompanyName('(株) テスト')).toBe('株式会社テスト');
    expect(fixCompanyName('テスト（株）')).toBe('テスト株式会社');
    expect(fixCompanyName('㈱ＡＢＣ')).toBe('株式会社ABC');
    expect(fixCompanyName('株式会社 テスト')).toBe('株式会社テスト');
  });

  it('makes phones half-width digits and hyphens', () => {
    expect(fixPhone('０３－５８２５－０７６０')).toBe('03-5825-0760');
    expect(fixPhone('03‑5825‑0760')).toBe('03-5825-0760');
    expect(fixPhone('03(1234)5678')).toBe('03-1234-5678');
    expect(fixPhone('(03)1234-5678')).toBe('03-1234-5678');
    expect(fixPhone('03 1234 5678')).toBe('03-1234-5678');
  });

  it('lists what it changed', () => {
    const { values, fixes } = cleanListRow({ name: '(株)テスト', phone: '03-1234-5678' });
    expect(values.name).toBe('株式会社テスト');
    expect(fixes).toEqual([{ field: 'name', before: '(株)テスト', after: '株式会社テスト' }]);
  });
});

describe('row checks', () => {
  it('removes 不明 and blank phones instead of reporting them', () => {
    expect(isUnknownPhone('不明')).toBe(true);
    expect(isUnknownPhone('')).toBe(true);
    expect(isUnknownPhone('03-1234-5678')).toBe(false);
  });

  it('accepts 「-」 as an unknown URL but not a blank one', () => {
    const base = { name: '株式会社テスト', phone: '03-1234-5678' };
    expect(validateListRow({ ...base, url: '-' })).toEqual([]);
    expect(validateListRow({ ...base, url: '' }).map((p) => p.field)).toEqual(['url']);
    expect(validateListRow({ ...base, url: 'www.example.com' }).map((p) => p.field)).toEqual([
      'url',
    ]);
  });

  it('rejects a phone with letters or the wrong length', () => {
    const base = { name: '株式会社テスト', url: '-' };
    expect(validateListRow({ ...base, phone: '03-1234-567' })[0]?.field).toBe('phone');
    expect(validateListRow({ ...base, phone: '03-1234-5678内線1' })[0]?.field).toBe('phone');
  });

  it('splits 上系 and the parent company, either way round', () => {
    expect(splitCompanyRank('上系島津製作所')).toEqual({ rank: '上系', parentName: '島津製作所' });
    expect(splitCompanyRank('コマツ上系')).toEqual({ rank: '上系', parentName: 'コマツ' });
    expect(splitCompanyRank('上場')).toEqual({ rank: '上場', parentName: null });
  });

  it('takes an address that ran on into 住所3 back out of the rank', () => {
    expect(splitRankCell('ビル3F　上場')).toEqual({ addressPart: 'ビル3F', rank: '上場' });
    expect(splitRankCell('OSAKA 2F　上系島津製作所')).toEqual({
      addressPart: 'OSAKA 2F',
      rank: '上系島津製作所',
    });
    expect(splitRankCell('非上場')).toEqual({ addressPart: '', rank: '非上場' });
  });

  it('labels Kyoto, Shiga and Nara with 「s」', () => {
    expect(isSArea('京都府')).toBe(true);
    expect(isSArea('大阪府')).toBe(false);
  });
});
