# Architecture

## Overview

One app, one login, one database. The role stored on the user (`TELEMA`, `SALES`, `ADMIN`, plus the
`isTeamLead` flag for telemarketing) decides which area of the web app a user can open.

| Area   | Path        | Who                                                 |
| ------ | ----------- | --------------------------------------------------- |
| テレマ | `/telema/*` | role `TELEMA` (lead features gated by `isTeamLead`) |
| 営業   | `/sales/*`  | role `SALES`                                        |
| 管理者 | `/admin/*`  | role `ADMIN`                                        |

The same rule must be enforced on the server: every API router for an area uses
`authenticator.requireRole(...)`. The web guards are for UX only.

## API (`apps/api`)

Layered, dependency-injected. Dependencies point inwards.

```
src/
  domain/           Entities and ports (interfaces). No framework imports.
    user/User.ts            business rules (lockout, password change)
    user/UserRepository.ts  persistence port
  modules/<feature>/  Use cases + HTTP for one feature
    AuthService.ts          application logic, depends on ports only
    AuthController.ts       maps HTTP <-> service
    authRouter.ts           routes, validation, rate limits
    PrismaUserRepository.ts port implementation
  http/             Errors, middleware (auth, CSRF, validation, error handler)
  infrastructure/   Prisma, logging, hashing, sessions
  container.ts      Composition root: the only place that wires concrete classes
  app.ts            Express app factory (takes dependencies, so tests can use fakes)
  main.ts           Process entry: config, server, graceful shutdown
```

### Adding a feature module

1. Add tables to `prisma/schema.prisma`, then `pnpm db:migrate --name <change>`.
2. Put request/response schemas and types in `packages/shared` so the web app reuses them.
3. Create `modules/<feature>/` with a repository (port in `domain/`), a service and a controller.
4. Register the classes in `container.ts` and mount the router in `app.ts` behind
   `requireAuth()` and `requireRole(...)`.
5. Unit-test the service with in-memory fakes (see `test/support/fakes.ts`).

### Security baseline

- Passwords: argon2id; temporary password on creation, change forced at first login.
- Login: per-account lockout (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`) + per-IP rate limit.
  Unknown emails take the same time and return the same error as wrong passwords.
- Sessions: server-side in PostgreSQL, httpOnly cookie, `Secure` in production, id regenerated on
  login, idle and absolute timeouts. Users are re-loaded per request so deactivation applies at once.
- CSRF: state-changing requests must send `X-Requested-With: telesales-web` (no CORS is enabled).
- Headers: helmet with a strict CSP. Logs redact cookies and password fields.
- Audit: logins, failures, lockouts, logouts, password changes and user creation go to `audit_logs`.

## Web (`apps/web`)

```
src/
  app/           router, paths, query client, App
  components/
    ui/          design-system primitives (Button, FormField, TextInput, Alert, RoleBadge)
    layout/      AppLayout, AppHeader, AuthLayout
  features/<feature>/
    api/         API classes (e.g. AuthApi) built on lib/api/ApiClient
    hooks/       TanStack Query hooks
    pages/       route components
    guards/      route guards
  i18n/ja.ts     every user-facing string
  styles/        design tokens (Tailwind @theme)
```

### UI conventions

- **Text**: all copy lives in `i18n/ja.ts`. Keep it short; use common katakana loanwords
  (ログイン, パスワード, テレマ, アポ, ダッシュボード) instead of forced translations.
- **Colours**: use semantic tokens only (`bg-main`, `text-ink-sub`, `border-line`, `bg-danger-soft` …).
  Module colours: 架電状況共有 = `calls` (orange), スケジュール管理 = `schedule` (blue).
  Role colours: `role-telema`, `role-sales`, `role-admin`.
- **Type**: system Japanese fonts, 16px base, line-height 1.5 (headings 1.25).
- **Forms**: visible labels, 必須 badge for required fields, inline errors under the field,
  `role="alert"` for submit errors, loading state on submit buttons.
- **Icons**: lucide-react only, `aria-hidden` when decorative; no emoji.
- **Server state**: TanStack Query. A 401 anywhere clears the session and returns the user to login.
