import ExcelJS from 'exceljs';
import { joinAddress, splitCompanyRank, splitRankCell } from '@telesales/shared';
import { describe, expect, it } from 'vitest';
import { readTableFile } from '../src/modules/companies/TableFileReader.js';

describe('企業ランク and 親会社名 (Sano 11/6)', () => {
  it('takes what follows 上系 as the parent company', () => {
    expect(splitCompanyRank('上系AGC')).toEqual({ rank: '上系', parentName: 'AGC' });
    expect(splitCompanyRank('上系豊田合成')).toEqual({ rank: '上系', parentName: '豊田合成' });
    expect(splitCompanyRank('上系')).toEqual({ rank: '上系', parentName: null });
  });

  it('leaves the other ranks as they are', () => {
    for (const rank of ['上場', '優良', '非上場', '中小企業', '対象外']) {
      expect(splitCompanyRank(rank)).toEqual({ rank, parentName: null });
    }
  });

  it('does not take 上系AGC apart at the address overflow step', () => {
    expect(splitRankCell('上系AGC')).toEqual({ addressPart: '', rank: '上系AGC' });
    expect(splitRankCell('ビル3F　上系AGC')).toEqual({ addressPart: 'ビル3F', rank: '上系AGC' });
  });

  it('ignores the text colour', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('リスト');
    sheet.addRow(['会社名', '企業ランク', '電話番号']);
    sheet.addRow(['株式会社A', '上系AGC', '06-6000-0000']);
    sheet.getCell('B2').font = { color: { argb: 'FFFF0000' } };
    const table = await readTableFile(
      'list.xlsx',
      Buffer.from((await book.xlsx.writeBuffer()) as ArrayBuffer),
    );
    expect(table.rows[0]).toEqual({
      row: 2,
      values: { 会社名: '株式会社A', 企業ランク: '上系AGC', 電話番号: '06-6000-0000' },
    });
  });
});

describe('joinAddress (Sano 11/6: 住所はつなげて1つの項目に)', () => {
  it('joins the parts with a space', () => {
    expect(joinAddress(['東京都港区六本木6-10-1', '六本木ヒルズ森タワー', undefined])).toBe(
      '東京都港区六本木6-10-1 六本木ヒルズ森タワー',
    );
  });

  it('continues without a space when a part was cut in the middle of the number', () => {
    expect(joinAddress(['兵庫県神戸市長田区東尻池町1-1-', '13サンスノービル2F201'])).toBe(
      '兵庫県神戸市長田区東尻池町1-1-13サンスノービル2F201',
    );
  });

  it('is empty when there is no address', () => {
    expect(joinAddress([undefined, undefined])).toBe('');
  });
});
