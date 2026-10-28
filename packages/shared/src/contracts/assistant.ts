import { z } from 'zod';

export type AssistantActionKind =
  'plan' | 'booking' | 'appointment' | 'callResult' | 'changeRequest';
export type AssistantActionStatus = 'PROPOSED' | 'DONE' | 'DISMISSED';

/**
 * Something MoraBot offers to do. The request was checked when it was proposed and is kept
 * on the server; nothing is saved until the person presses 確定, and then the server runs it
 * through the same services as the screens (so the usual checks, notices and audit apply).
 */
export interface AssistantProposal {
  id: string;
  kind: AssistantActionKind;
  /** Card heading, e.g. 「予定を入れる」. */
  title: string;
  /** Exactly what will be saved, as shown on the card. */
  lines: { label: string; value: string }[];
  warnings: string[];
  /** The related screen (a slot hold opens it on 確定). */
  link: string;
  confirmLabel: string;
  status: AssistantActionStatus;
  /** Where the result can be seen, after 確定. */
  resultLink: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** One thing MoraBot did while answering, e.g. 「山田さんの11/4の空き時間を確認」. */
export interface AssistantStep {
  text: string;
  ok: boolean;
}

/** A question with choices, like a form MoraBot fills in with the person. */
export interface AssistantQuestion {
  question: string;
  options: { label: string; description?: string }[];
}

export interface AssistantMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'event';
  content: string;
  steps: AssistantStep[];
  question: AssistantQuestion | null;
  /** The screen MoraBot opened for the person. */
  openedPath: string | null;
  actions: AssistantProposal[];
  createdAt: string;
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  actionCount: number;
}

export interface AssistantConversationDto {
  id: string;
  title: string;
  messages: AssistantMessageDto[];
}

/** An action in the history list, with the conversation it came from. */
export interface AssistantActionHistoryItem extends AssistantProposal {
  conversationId: string;
  conversationTitle: string;
}

export const assistantChatRequestSchema = z.object({
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1).max(2000),
  /** The screen the person is on, so 「この会社」 means something. */
  path: z.string().max(300).nullish(),
});
export type AssistantChatRequest = z.input<typeof assistantChatRequestSchema>;

/** Streamed (one JSON object per line) while MoraBot works on a message. */
export type AssistantStreamEvent =
  | { type: 'conversation'; id: string; title: string }
  | { type: 'user'; message: AssistantMessageDto }
  | { type: 'step'; step: AssistantStep }
  | { type: 'message'; message: AssistantMessageDto }
  | { type: 'error'; code: string; reason?: string };

export interface AssistantDecisionResult {
  action: AssistantProposal;
  message: AssistantMessageDto;
}
