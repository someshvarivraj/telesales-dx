import {
  DayBeforeResult,
  formatJstDateTime,
  formatSlashDate,
  jstDate,
  jstTime,
  MeetingFormat,
  weekdayJa,
} from '@telesales/shared';

/** Everything the e-mails need about one appointment. */
export interface MailAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  format: MeetingFormat;
  customerTypeLabel: string | null;
  listName: string | null;
  bookedAt: Date;
  bookerName: string;
  repName: string;
  contactName: string | null;
  contactDepartment: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  handoverNotes: string | null;
  visitAddress: string | null;
  meetingUrl: string | null;
  company: {
    name: string;
    clientNo: string | null;
    nearestStation: string | null;
    address: string | null;
    phone: string | null;
    department: string | null;
  };
}

export interface MailContent {
  subject: string;
  body: string;
}

/** Today's mails write online meetings as "Web". */
const FORMAT_IN_MAIL: Record<MeetingFormat, string> = {
  [MeetingFormat.Visit]: '訪問',
  [MeetingFormat.Online]: 'Web',
};

const DAY_BEFORE_LABEL: Record<DayBeforeResult, string> = {
  [DayBeforeResult.Confirmed]: '確認済み',
  [DayBeforeResult.NotReached]: '未確認（連絡がつかず）',
  [DayBeforeResult.Changed]: '変更あり',
};

/** 「小田 理恵」 → 「小田」 (today's mails show the booker's family name). */
export function familyName(fullName: string): string {
  return fullName.trim().split(/[\s　]+/)[0] ?? fullName;
}

function companyLine(appointment: MailAppointment): string {
  const clientNo = appointment.company.clientNo ? `[${appointment.company.clientNo}] ` : '';
  return `${clientNo}${appointment.company.name}`;
}

function value(text: string | null | undefined): string {
  return text?.trim() ?? '';
}

/**
 * N1 — the booking e-mail, in the same field order as today's 「営業さんへの伝達事項」 (spec §8).
 * The body can still be edited on the preview screen before sending.
 */
export function bookingMail(
  appointment: MailAppointment,
  options: { resend?: boolean } = {},
): MailContent {
  const tag = options.resend ? '【再送】' : '';
  const lines = [
    `[対応者] ${appointment.repName}`,
    `[訪問日時] ${formatJstDateTime(appointment.startsAt)}`,
    `[取引区分] ${value(appointment.customerTypeLabel)}`,
    `[訪問形態] ${FORMAT_IN_MAIL[appointment.format]}`,
    `[会社名] ${companyLine(appointment)}`,
    `[最寄駅] ${value(appointment.company.nearestStation)}`,
    `[住所] ${value(appointment.visitAddress ?? appointment.company.address)}`,
    `[代表TEL] ${value(appointment.company.phone)}`,
    `[部署] ${value(appointment.contactDepartment ?? appointment.company.department)}`,
    `[氏名] ${value(appointment.contactName)}`,
    `[TEL] ${value(appointment.contactPhone)}`,
    `[Mail] ${value(appointment.contactEmail)}`,
    '',
    `[伝達事項] ${options.resend ? '【再送】' : ''}${value(appointment.handoverNotes)}`,
    '',
    `[テレマリスト名] ${value(appointment.listName)}`,
    `[アポ取得] ${formatSlashDate(jstDate(appointment.bookedAt))} ${familyName(appointment.bookerName)}`,
  ];
  return {
    subject: `営業さんへの伝達事項${tag}（${appointment.company.name}）`,
    body: `${lines.join('\n')}\n`,
  };
}

/** N8 — sent manually after a telemarketer confirms the cancellation. */
export function cancellationMail(appointment: MailAppointment, note: string | null): MailContent {
  const lines = [
    `下記のアポは取り消しになりました。`,
    '',
    `[対応者] ${appointment.repName}`,
    `[訪問日時] ${formatJstDateTime(appointment.startsAt)}`,
    `[訪問形態] ${FORMAT_IN_MAIL[appointment.format]}`,
    `[会社名] ${companyLine(appointment)}`,
    `[氏名] ${value(appointment.contactName)}`,
    `[理由] ${value(note)}`,
    '',
    `[アポ取得] ${formatSlashDate(jstDate(appointment.bookedAt))} ${familyName(appointment.bookerName)}`,
  ];
  return {
    subject: `アポ取り消しのお知らせ（${appointment.company.name}）`,
    body: `${lines.join('\n')}\n`,
  };
}

/** N14 — day-before result for checks done after 12:00 (company, time, result, checker). */
export function dayBeforeResultMail(
  appointment: MailAppointment,
  result: DayBeforeResult,
  checkerName: string,
): MailContent {
  const lines = [
    `前日確認の結果をお知らせします。`,
    '',
    `[会社名] ${companyLine(appointment)}`,
    `[訪問日時] ${formatJstDateTime(appointment.startsAt)}`,
    `[訪問形態] ${FORMAT_IN_MAIL[appointment.format]}`,
    `[確認結果] ${DAY_BEFORE_LABEL[result]}`,
    `[確認した人] ${checkerName}`,
  ];
  return {
    subject: `前日確認の結果（${appointment.company.name}）`,
    body: `${lines.join('\n')}\n`,
  };
}

function scheduleLine(appointment: MailAppointment, appBaseUrl: string): string[] {
  const day = jstDate(appointment.startsAt);
  return [
    `■ ${formatSlashDate(day)}（${weekdayJa(day)}） ${jstTime(appointment.startsAt)}〜${jstTime(appointment.endsAt)}　${FORMAT_IN_MAIL[appointment.format]}`,
    `　${companyLine(appointment)}　${value(appointment.contactName)}`,
    appointment.format === MeetingFormat.Online
      ? `　会議URL：${appointment.meetingUrl ?? '未登録'}`
      : `　住所：${value(appointment.visitAddress ?? appointment.company.address)}`,
    `　${appBaseUrl}/appointments/${appointment.id}`,
  ];
}

/** N4 — at 12:00 on the previous business day, one e-mail per rep. */
export function tomorrowAppointmentsMail(
  repName: string,
  dates: string[],
  appointments: MailAppointment[],
  appBaseUrl: string,
): MailContent {
  const first = dates[0] ?? '';
  const last = dates[dates.length - 1] ?? first;
  const period =
    first === last ? formatSlashDate(first) : `${formatSlashDate(first)}〜${formatSlashDate(last)}`;
  const lines = [
    `${repName}さん`,
    '',
    `${period} のアポは ${appointments.length}件 です。`,
    '',
    ...appointments.flatMap((appointment) => [...scheduleLine(appointment, appBaseUrl), '']),
  ];
  return { subject: `翌日のアポ（${period}）`, body: `${lines.join('\n')}\n` };
}

/** N19 — the day's booked appointments, with the report Excel attached. */
export function dailyListMail(date: string, count: number): MailContent {
  return {
    subject: `本日のアポ取得一覧（${formatSlashDate(date)}）`,
    body: `${formatSlashDate(date)} のアポ取得は ${count}件 です。\n一覧をExcelで添付します。\n`,
  };
}
