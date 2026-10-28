/**
 * Something MoraBot offers to do. Nothing is saved until the person presses the card's
 * button: then the browser sends `request` to the same API the screens use (so the usual
 * checks, notifications and audit apply), or opens `link` for a slot hold.
 */
export interface AssistantProposal {
  id: string;
  kind: 'plan' | 'booking' | 'callResult' | 'changeRequest';
  /** Card heading, e.g. 「予定を入れる」. */
  title: string;
  /** Exactly what will be saved, as shown on the card. */
  lines: { label: string; value: string }[];
  warnings: string[];
  /** POST body for an in-app API path; null when 確定 opens `link` instead. */
  request: { path: string; body: Record<string, unknown> } | null;
  /** The related screen: opened by 確定 (slot hold) or offered after saving. */
  link: string;
  confirmLabel: string;
}

export interface AssistantReply {
  reply: string;
  proposals: AssistantProposal[];
}
