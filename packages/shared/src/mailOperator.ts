import { Role } from './roles.js';

/** Who sent an e-mail, as written in it (Sano 10/24 No.6). */
export interface MailOperator {
  name: string;
  roles: readonly Role[];
}

/** The team name shown after the sender's name: テレマ, 営業, 管理者 or 閲覧. */
export function operatorRoleLabel(roles: readonly Role[]): string {
  if (roles.includes(Role.TelemaLead) || roles.includes(Role.Telema)) return 'テレマ';
  if (roles.includes(Role.Sales)) return '営業';
  if (roles.includes(Role.Admin)) return '管理者';
  return '閲覧';
}

/** 南口 淑美 → 南口 (family name before the space; the whole name when there is none). */
export function familyName(name: string): string {
  return name.trim().split(/[\s　]+/)[0] ?? name;
}

/**
 * A shared sender address (e.g. terema@) does not say who did the work, so every e-mail
 * sent from the app carries the operator: 「【担当：南口】」 at the end of the subject and
 * 「送信者：南口 淑美（テレマ）」 as the last line. Already stamped text is left as is.
 */
export function stampOperator(
  mail: { subject: string; body: string },
  operator: MailOperator,
): { subject: string; body: string } {
  const tag = `【担当：${familyName(operator.name)}】`;
  const line = `送信者：${operator.name.trim()}（${operatorRoleLabel(operator.roles)}）`;
  return {
    subject: mail.subject.includes('【担当：') ? mail.subject : `${mail.subject}${tag}`,
    body: mail.body.includes('送信者：') ? mail.body : `${mail.body.trimEnd()}\n\n${line}\n`,
  };
}

/** Scheduled e-mails (N4, N19) have no operator: say they were sent automatically. */
export const AUTOMATIC_SENDER_LINE = '送信者：テレマ・営業DX（自動送信）';

export function stampAutomatic(body: string): string {
  return body.includes('送信者：') ? body : `${body.trimEnd()}\n\n${AUTOMATIC_SENDER_LINE}\n`;
}
