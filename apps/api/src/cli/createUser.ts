/**
 * Creates a user and prints a one-time temporary password.
 *
 *   pnpm user:create --email a@example.co.jp --name "山田 太郎" --role ADMIN
 *   pnpm user:create --email b@example.co.jp --name "佐藤 花子" --role TELEMA --lead
 */
import { parseArgs } from 'node:util';
import { isRole } from '@telesales/shared';
import { AppConfig } from '../config/AppConfig.js';
import { Container } from '../container.js';

async function run(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
      lead: { type: 'boolean', default: false },
    },
  });

  if (!values.email || !values.name || !isRole(values.role)) {
    throw new Error(
      'Usage: --email <email> --name <display name> --role <TELEMA|SALES|ADMIN> [--lead]',
    );
  }

  const container = new Container(AppConfig.fromEnv());
  try {
    const { user, temporaryPassword } = await container.userService.createUser({
      email: values.email,
      displayName: values.name,
      role: values.role,
      isTeamLead: values.lead,
    });
    process.stdout.write(
      [
        'User created.',
        `  email: ${user.email}`,
        `  role:  ${user.role}${user.isTeamLead ? ' (lead)' : ''}`,
        `  temporary password: ${temporaryPassword}`,
        'Share the password through a secure channel. It must be changed at first login.',
        '',
      ].join('\n'),
    );
  } finally {
    await container.dispose();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
