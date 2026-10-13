# Contributing

## Branches

- `main` is always deployable. Do not push to it directly.
- Branch from `main`: `feat/<area>-<short-name>`, `fix/<short-name>`, `chore/<short-name>`
  (e.g. `feat/telema-call-list`, `feat/sales-schedule-week`).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat(telema): add today's call list`,
`fix(auth): keep redirect after login`, `chore: bump prisma`.

## Pull requests

- Keep PRs small and focused on one feature or fix.
- CI must pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Include screenshots for UI changes (PC and tablet width).
- Database changes: commit the generated migration under `apps/api/prisma/migrations/`.
  Never edit a migration that is already on `main`; add a new one.
- At least one review before merging. Squash-merge.

## Code ownership (current split)

| Area                                         | Owner  |
| -------------------------------------------- | ------ |
| Foundation (login, roles, DB, shared parts)  | Vraj   |
| テレマ dashboard (`/telema`, regular + lead) | Raturi |
| 営業 dashboard (`/sales`)                    | Vraj   |
| 管理者 dashboard (`/admin`)                  | Vraj   |
| AWS / infrastructure                         | Raturi |

Changes to `packages/shared`, `apps/api/src/http`, `apps/web/src/components/ui` or the design tokens
affect everyone — mention them in the PR description.
