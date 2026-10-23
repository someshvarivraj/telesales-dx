import {
  Bell,
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  CalendarX,
  ClipboardCheck,
  Clock,
  FileCheck,
  FileSpreadsheet,
  ListChecks,
  ListPlus,
  type LucideIcon,
  MessageSquare,
  MessageSquareWarning,
  Pencil,
  UserPlus,
  Video,
  VideoOff,
} from 'lucide-react';

/** Colour family of a notice: tells kinds apart at a glance, like an activity feed. */
export type NoticeTone =
  'appointment' | 'schedule' | 'calls' | 'warning' | 'danger' | 'success' | 'neutral';

export interface NoticeKind {
  label: string;
  icon: LucideIcon;
  tone: NoticeTone;
}

const KINDS: Record<string, NoticeKind> = {
  N1: { label: '新しいアポ', icon: CalendarPlus, tone: 'appointment' },
  N2: { label: '会議リンク', icon: Video, tone: 'schedule' },
  N3: { label: '会議URL未登録', icon: VideoOff, tone: 'warning' },
  N4: { label: '翌日のアポ', icon: CalendarClock, tone: 'schedule' },
  N6: { label: '日程変更', icon: CalendarClock, tone: 'schedule' },
  N7: { label: '変更依頼', icon: MessageSquareWarning, tone: 'warning' },
  N8: { label: '取り消し', icon: CalendarX, tone: 'danger' },
  N9: { label: '同席', icon: UserPlus, tone: 'schedule' },
  N10: { label: '予定の変更', icon: Pencil, tone: 'neutral' },
  N11: { label: '今日の担当', icon: ListChecks, tone: 'calls' },
  N12: { label: '前日確認', icon: ClipboardCheck, tone: 'warning' },
  N13: { label: '変更依頼', icon: Clock, tone: 'warning' },
  N14: { label: '前日確認の結果', icon: ClipboardCheck, tone: 'calls' },
  N15: { label: '仮予定', icon: CalendarOff, tone: 'warning' },
  N16: { label: '打ち合わせ結果', icon: FileCheck, tone: 'success' },
  N17: { label: '架電リスト', icon: ListPlus, tone: 'calls' },
  N18: { label: 'コメント', icon: MessageSquare, tone: 'schedule' },
  N19: { label: 'アポ取得一覧', icon: FileSpreadsheet, tone: 'neutral' },
};

const FALLBACK: NoticeKind = { label: 'お知らせ', icon: Bell, tone: 'neutral' };

export function noticeKindOf(code: string): NoticeKind {
  return KINDS[code] ?? FALLBACK;
}

export const TONE_CLASS: Record<NoticeTone, string> = {
  appointment: 'bg-appointments-soft text-appointments',
  schedule: 'bg-schedule-soft text-schedule',
  calls: 'bg-calls-soft text-calls',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  neutral: 'bg-admin-soft text-admin',
};

/** 「たった今」「5分前」「3時間前」「昨日 14:05」「10/12（月）」 — as chat apps show it. */
export function relativeTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const day = dayGroupOf(iso, now);
  const time = at.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (day === 'today') return `${Math.floor(minutes / 60)}時間前`;
  if (day === 'yesterday') return `昨日 ${time}`;
  return at.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export type DayGroup = 'today' | 'yesterday' | 'earlier';

export const DAY_GROUP_LABEL: Record<DayGroup, string> = {
  today: '今日',
  yesterday: '昨日',
  earlier: 'それ以前',
};

function jstDay(instant: Date): string {
  return instant.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export function dayGroupOf(iso: string, now = new Date()): DayGroup {
  const day = jstDay(new Date(iso));
  if (day === jstDay(now)) return 'today';
  if (day === jstDay(new Date(now.getTime() - 86_400_000))) return 'yesterday';
  return 'earlier';
}

/** Filter groups for the activity page: few chips, each one colour. */
export interface NoticeCategory {
  key: string;
  label: string;
  tone: NoticeTone;
  icon: LucideIcon;
  codes: string[];
}

export const NOTICE_CATEGORIES: NoticeCategory[] = [
  {
    key: 'appointment',
    label: 'アポ',
    tone: 'appointment',
    icon: CalendarPlus,
    codes: ['N1', 'N6', 'N8', 'N16'],
  },
  {
    key: 'request',
    label: '変更依頼',
    tone: 'warning',
    icon: MessageSquareWarning,
    codes: ['N7', 'N13'],
  },
  {
    key: 'schedule',
    label: '予定・会議',
    tone: 'schedule',
    icon: CalendarClock,
    codes: ['N2', 'N3', 'N4', 'N9', 'N10', 'N15'],
  },
  {
    key: 'dayBefore',
    label: '前日確認',
    tone: 'success',
    icon: ClipboardCheck,
    codes: ['N12', 'N14'],
  },
  {
    key: 'calls',
    label: '架電・テレマ',
    tone: 'calls',
    icon: ListChecks,
    codes: ['N11', 'N17', 'N19'],
  },
  { key: 'comment', label: 'コメント', tone: 'neutral', icon: MessageSquare, codes: ['N18'] },
];

/** Solid accent per tone: the bar on the selected item and the chip's dot. */
export const TONE_BAR: Record<NoticeTone, string> = {
  appointment: 'bg-appointments',
  schedule: 'bg-schedule',
  calls: 'bg-calls',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
  neutral: 'bg-admin',
};
