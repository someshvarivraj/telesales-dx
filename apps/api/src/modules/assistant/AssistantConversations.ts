import type {
  AssistantActionHistoryItem,
  AssistantActionKind,
  AssistantActionStatus,
  AssistantChatRequest,
  AssistantConversationDto,
  AssistantConversationSummary,
  AssistantDecisionResult,
  AssistantMessageDto,
  AssistantProposal,
  AssistantQuestion,
  AssistantStep,
  AssistantStreamEvent,
} from '@telesales/shared';
import type { Actor } from '../../domain/access/AccessPolicy.js';
import type { Clock } from '../../domain/Clock.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { InvalidStateError, NotFoundError } from '../../http/errors/AppError.js';
import type { AssistantActionRunner } from './AssistantActionRunner.js';
import type { AssistantService, ChatTurn, ChatUser } from './AssistantService.js';

/** Earlier messages replayed to the model with each new one. */
const HISTORY = 20;
/** A card older than this has to be asked for again (its checks may be stale). */
const CARD_TTL_MS = 24 * 60 * 60_000;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

type ActionRow = Prisma.AssistantActionGetPayload<object>;
type MessageRow = Prisma.AssistantMessageGetPayload<{ include: { actions: true } }>;

function toProposal(row: ActionRow): AssistantProposal {
  return {
    id: row.id,
    kind: row.kind as AssistantActionKind,
    title: row.title,
    lines: row.lines as AssistantProposal['lines'],
    warnings: row.warnings as string[],
    link: row.link,
    confirmLabel: row.confirmLabel,
    status: row.status as AssistantActionStatus,
    resultLink: row.resultLink,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

function toMessage(row: MessageRow): AssistantMessageDto {
  return {
    id: row.id,
    role: row.role as AssistantMessageDto['role'],
    content: row.content,
    steps: (row.steps as AssistantStep[] | null) ?? [],
    question: (row.question as AssistantQuestion | null) ?? null,
    openedPath: row.openedPath,
    actions: row.actions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toProposal),
    createdAt: row.createdAt.toISOString(),
  };
}

/** How a past message is replayed to the model: cards and their outcome in words. */
function toTurn(row: MessageRow): ChatTurn {
  if (row.role === 'user') return { role: 'user', content: row.content };
  const cards = row.actions.map((action) => {
    const state =
      action.status === 'DONE' ? '確定済み' : action.status === 'DISMISSED' ? '取りやめ' : '未確定';
    const lines = (action.lines as { label: string; value: string }[])
      .map((line) => `${line.label}=${line.value}`)
      .join('、');
    return `［カード「${action.title}」（${state}）：${lines}］`;
  });
  return { role: 'assistant', content: [row.content, ...cards].join('\n') };
}

/**
 * MoraBot's memory: conversations, what it did, and the cards people confirmed. Every
 * read and write is limited to the signed-in person's own conversations.
 */
export class AssistantConversations {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly assistant: AssistantService,
    private readonly runner: AssistantActionRunner,
    private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<AssistantConversationSummary[]> {
    const rows = await this.prisma.assistantConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { actions: { where: { status: 'DONE' } } } } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      actionCount: row._count.actions,
    }));
  }

  async get(userId: string, id: string): Promise<AssistantConversationDto> {
    const row = await this.prisma.assistantConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, include: { actions: true } } },
    });
    if (!row) throw new NotFoundError();
    return { id: row.id, title: row.title, messages: row.messages.map(toMessage) };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.assistantConversation.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundError();
  }

  /** Everything MoraBot proposed for this person, newest first. */
  async actions(userId: string): Promise<AssistantActionHistoryItem[]> {
    const rows = await this.prisma.assistantAction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { conversation: { select: { title: true } } },
    });
    return rows.map((row) => ({
      ...toProposal(row),
      conversationId: row.conversationId,
      conversationTitle: row.conversation.title,
    }));
  }

  /** One message from the person: MoraBot works on it and reports each step as it goes. */
  async chat(
    actor: Actor,
    user: ChatUser,
    request: AssistantChatRequest,
    emit: (event: AssistantStreamEvent) => void,
  ): Promise<void> {
    const conversation = request.conversationId
      ? await this.prisma.assistantConversation.findFirst({
          where: { id: request.conversationId, userId: actor.id },
        })
      : await this.prisma.assistantConversation.create({
          data: { userId: actor.id, title: request.message.replace(/\s+/g, ' ').slice(0, 40) },
        });
    if (!conversation) throw new NotFoundError();
    emit({ type: 'conversation', id: conversation.id, title: conversation.title });

    const earlier = await this.prisma.assistantMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY,
      include: { actions: true },
    });
    const asked = await this.prisma.assistantMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: request.message },
      include: { actions: true },
    });
    emit({ type: 'user', message: toMessage(asked) });

    const turns = [
      ...earlier.reverse().map(toTurn),
      { role: 'user' as const, content: request.message },
    ];
    const answer = await this.assistant.chat(actor, user, turns, {
      screen: await this.describeScreen(request.path),
      onStep: (step) => emit({ type: 'step', step }),
    });

    const saved = await this.prisma.$transaction(async (tx) => {
      const message = await tx.assistantMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: answer.reply,
          steps: answer.steps as unknown as Prisma.InputJsonValue,
          question: (answer.question ?? undefined) as Prisma.InputJsonValue | undefined,
          openedPath: answer.openPath,
        },
      });
      for (const proposal of answer.proposals) {
        await tx.assistantAction.create({
          data: {
            id: proposal.id,
            conversationId: conversation.id,
            messageId: message.id,
            userId: actor.id,
            kind: proposal.kind,
            title: proposal.title,
            lines: proposal.lines,
            warnings: proposal.warnings,
            payload: (proposal.payload ?? undefined) as Prisma.InputJsonValue | undefined,
            link: proposal.link,
            confirmLabel: proposal.confirmLabel,
          },
        });
      }
      await tx.assistantConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: this.clock.now() },
      });
      return tx.assistantMessage.findUniqueOrThrow({
        where: { id: message.id },
        include: { actions: true },
      });
    });
    emit({ type: 'message', message: toMessage(saved) });
  }

  /** 確定 runs the card's checked request as the person; やめる just records the choice. */
  async decide(
    actor: Actor,
    actionId: string,
    decision: 'confirm' | 'dismiss',
  ): Promise<AssistantDecisionResult> {
    const action = await this.prisma.assistantAction.findFirst({
      where: { id: actionId, userId: actor.id },
    });
    if (!action) throw new NotFoundError();
    if (action.status !== 'PROPOSED') {
      throw new InvalidStateError({ reason: 'already_decided' });
    }
    let resultLink: string | null = null;
    if (decision === 'confirm') {
      if (this.clock.now().getTime() - action.createdAt.getTime() > CARD_TTL_MS) {
        throw new InvalidStateError({ reason: 'card_expired' });
      }
      resultLink = await this.runner.run(actor, {
        kind: action.kind as AssistantActionKind,
        payload: action.payload,
        link: action.link,
      });
    }
    const now = this.clock.now();
    const content =
      decision === 'confirm'
        ? action.kind === 'booking'
          ? `【確定】「${action.title}」：登録画面を開き、枠を押さえました。`
          : `【確定】「${action.title}」を保存しました。`
        : `「${action.title}」は取りやめました。`;
    const [updated, event] = await this.prisma.$transaction([
      this.prisma.assistantAction.update({
        where: { id: action.id },
        data: {
          status: decision === 'confirm' ? 'DONE' : 'DISMISSED',
          decidedAt: now,
          resultLink,
        },
      }),
      this.prisma.assistantMessage.create({
        data: { conversationId: action.conversationId, role: 'event', content },
        include: { actions: true },
      }),
      this.prisma.assistantConversation.update({
        where: { id: action.conversationId },
        data: { updatedAt: now },
      }),
    ]);
    return { action: toProposal(updated), message: toMessage(event) };
  }

  /** The screen in words, so 「この会社」「このアポ」 can be understood. */
  private async describeScreen(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const company = new RegExp(`^/companies/(${UUID})`).exec(path)?.[1];
    if (company) {
      const row = await this.prisma.company.findUnique({
        where: { id: company },
        select: { name: true, office: true },
      });
      if (row) return `企業のページ（${row.name}${row.office ? ` ${row.office}` : ''}） ${path}`;
    }
    const appointment = new RegExp(`^/appointments/(${UUID})`).exec(path)?.[1];
    if (appointment) {
      const row = await this.prisma.appointment.findUnique({
        where: { id: appointment },
        select: { startsAt: true, company: { select: { name: true } } },
      });
      if (row) {
        return `アポのページ（${row.company.name}、${row.startsAt.toISOString()}） ${path}`;
      }
    }
    return path;
  }
}
