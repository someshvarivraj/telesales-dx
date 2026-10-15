import {
  APP_KEY,
  isRole,
  type NoticeCode,
  RecipientField,
  RecipientKind,
  type RecipientContext,
} from '@telesales/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

/** People known to the event that triggered the notice, keyed by context name. */
export type NoticeContext = Partial<
  Record<RecipientContext, readonly (string | null | undefined)[]>
>;

export interface ResolvedRecipients {
  enabled: boolean;
  sendsEmail: boolean;
  /** Users who get the on-screen notice (TO and CC). */
  userIds: string[];
  to: string[];
  cc: string[];
}

/**
 * Turns the admin-configured recipients of a notice (spec §8: never hard-coded) into
 * concrete users and addresses for one event.
 */
export class RecipientResolver {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(code: NoticeCode, context: NoticeContext = {}): Promise<ResolvedRecipients> {
    const setting = await this.prisma.noticeSetting.findUnique({
      where: { code },
      include: { recipients: true },
    });
    if (!setting) {
      return { enabled: false, sendsEmail: false, userIds: [], to: [], cc: [] };
    }

    const usersByField = {
      [RecipientField.To]: new Set<string>(),
      [RecipientField.Cc]: new Set<string>(),
    };
    const emailsByField = {
      [RecipientField.To]: new Set<string>(),
      [RecipientField.Cc]: new Set<string>(),
    };
    const roles = {
      [RecipientField.To]: new Set<string>(),
      [RecipientField.Cc]: new Set<string>(),
    };

    for (const recipient of setting.recipients) {
      const field = recipient.field;
      switch (recipient.kind) {
        case RecipientKind.Email:
          emailsByField[field].add(recipient.value.trim().toLowerCase());
          break;
        case RecipientKind.User:
          usersByField[field].add(recipient.value);
          break;
        case RecipientKind.Role:
          if (isRole(recipient.value)) {
            roles[field].add(recipient.value);
          }
          break;
        case RecipientKind.Context:
          for (const id of context[recipient.value as RecipientContext] ?? []) {
            if (id) {
              usersByField[field].add(id);
            }
          }
          break;
      }
    }

    for (const field of [RecipientField.To, RecipientField.Cc] as const) {
      if (roles[field].size > 0) {
        const members = await this.prisma.userAppRole.findMany({
          where: {
            appKey: APP_KEY,
            role: { in: [...roles[field]] as never },
            user: { status: 'ACTIVE' },
          },
          select: { userId: true },
        });
        members.forEach((member) => usersByField[field].add(member.userId));
      }
    }

    const allUserIds = [...new Set([...usersByField.TO, ...usersByField.CC])];
    const users = await this.prisma.user.findMany({
      where: { id: { in: allUserIds }, status: 'ACTIVE' },
      select: { id: true, email: true },
    });
    const emailOf = new Map(users.map((user) => [user.id, user.email]));
    for (const field of [RecipientField.To, RecipientField.Cc] as const) {
      usersByField[field].forEach((id) => {
        const email = emailOf.get(id);
        if (email) {
          emailsByField[field].add(email);
        }
      });
    }
    // Someone in TO does not also need to be in CC.
    emailsByField.TO.forEach((email) => emailsByField.CC.delete(email));

    return {
      enabled: setting.isEnabled,
      sendsEmail: setting.sendsEmail,
      userIds: users.map((user) => user.id),
      to: [...emailsByField.TO],
      cc: [...emailsByField.CC],
    };
  }
}
