import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readTableFile } from '../src/modules/companies/TableFileReader.js';

async function workbookWith(rank: ExcelJS.CellValue, font?: Partial<ExcelJS.Font>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('リスト');
  sheet.addRow(['会社名', '電話番号', 'URL', '企業ランク']);
  sheet.addRow(['テスト通信株式会社', '06-6000-0001', 'https://example.co.jp', rank]);
  if (font) sheet.getCell('D2').font = font;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('企業ランク with the parent company in red (request 10/29 ④)', () => {
  it('reads the red part of 「NTT上系」 separately', async () => {
    const content = await workbookWith({
      richText: [{ text: 'NTT', font: { color: { argb: 'FFFF0000' } } }, { text: '上系' }],
    });
    const table = await readTableFile('list.xlsx', content);
    expect(table.rows[0]?.values['企業ランク']).toBe('NTT上系');
    expect(table.rows[0]?.red).toEqual({ 企業ランク: 'NTT' });
  });

  it('treats a cell in red font as all red, and black text as no parent', async () => {
    const red = await readTableFile(
      'list.xlsx',
      await workbookWith('トヨタ', { color: { argb: 'FFFF0000' } }),
    );
    expect(red.rows[0]?.red).toEqual({ 企業ランク: 'トヨタ' });
    const plain = await readTableFile('list.xlsx', await workbookWith('上場'));
    expect(plain.rows[0]?.red).toBeUndefined();
  });
});
