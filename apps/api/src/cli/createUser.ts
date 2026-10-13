/**
 * Creates a user and prints a one-time temporary password.
 *
 *   pnpm user:create --email a@example.co.jp --name "山田 太郎" --roles ADMIN
 *   pnpm user:create --email b@example.co.jp --name "佐藤 花子" --employee-no 1234 --roles TELEMA,TELEMA_LEAD
 */
import { parseArgs } from 'node:util';
import { ALL_ROLES, isRole, type Role } from '@telesales/shared';
import { AppConfig } from '../config/AppConfig.js';
import { Container } from '../container.js';

const USAGE = `Usage: --email <email> --name <name> --roles <${ALL_ROLES.join('|')}>[,...] [--employee-no <no>]`;

async function run(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      roles: { type: 'string' },
      'employee-no': { type: 'string' },
    },
  });

  const roles = (values.roles ?? '').split(',').map((role) => role.trim().toUpperCase());
  if (!values.email || !values.name || roles.length === 0 || !roles.every(isRole)) {
    throw new Error(USAGE);
  }

  const container = new Container(AppConfig.fromEnv());
  try {
    const { user, temporaryPassword } = await container.userService.createUser({
      email: values.email,
      name: values.name,
      employeeNo: values['employee-no'] ?? null,
      roles: roles as Role[],
    });
    process.stdout.write(
      [
        'User created.',
        `  email: ${user.email}`,
        `  roles: ${user.roles.join(', ')}`,
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
