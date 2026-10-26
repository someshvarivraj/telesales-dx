import { describe, expect, it } from 'vitest';
import { familyName, operatorRoleLabel, stampAutomatic, stampOperator } from './mailOperator.js';
import { Role } from './roles.js';

describe('stampOperator', () => {
  const operator = { name: '南口 淑美', roles: [Role.Telema, Role.TelemaLead] };

  it('adds the family name to the subject and the sender line to the body', () => {
    const mail = stampOperator(
      { subject: '営業さんへの伝達事項（◯◯株式会社）', body: '本文です。\n\n' },
      operator,
    );
    expect(mail.subject).toBe('営業さんへの伝達事項（◯◯株式会社）【担当：南口】');
    expect(mail.body).toBe('本文です。\n\n送信者：南口 淑美（テレマ）\n');
  });

  it('does not stamp twice', () => {
    const once = stampOperator({ subject: '件名', body: '本文' }, operator);
    expect(stampOperator(once, { name: '小林 貴也', roles: [Role.Sales] })).toEqual(once);
  });

  it('names the team from the roles and the family name from the full name', () => {
    expect(operatorRoleLabel([Role.Sales])).toBe('営業');
    expect(operatorRoleLabel([Role.Admin, Role.Sales])).toBe('営業');
    expect(operatorRoleLabel([Role.Admin])).toBe('管理者');
    expect(familyName('千原')).toBe('千原');
    expect(familyName('小林　貴也')).toBe('小林');
  });

  it('marks scheduled e-mails as sent automatically', () => {
    expect(stampAutomatic('一覧です。')).toBe('一覧です。\n\n送信者：テレマ・営業DX（自動送信）\n');
  });
});
