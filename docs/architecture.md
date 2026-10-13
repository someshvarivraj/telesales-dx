# Architecture

## Overview

One app, one login, one database (spec v1 §3). Users are company-wide; roles are granted per app
(`user_app_roles`, several rows per user). Roles never appear in feature code — everything checks
**permissions** from `packages/shared/src/permissions.ts`, which mirrors the spec §4 table.

| Role          | 日本語   | Notes                                                                 |
| ------------- | -------- | --------------------------------------------------------------------- |
| `TELEMA`      | テレマ   | makes calls                                                           |
| `TELEMA_LEAD` | リーダー | everything TELEMA has + list import, duplicate resolution, allocation |
| `SALES`       | 営業     | meetings, own plans, change requests                                  |
| `VIEWER`      | 閲覧     | DX team etc.: view + comment only                                     |
| `ADMIN`       | 管理者   | all permissions                                                       |

Exceptions such as "the person entrusted with the area table" are rows in
`user_permission_grants`, not code. Row-level rules ("own records", "assigned or attending")
are enforced in each service.

Routes are module-based (`/calls`, `/schedule`, `/appointments`, `/admin/*`). The home screen
shows the cards the user's permissions allow; the API checks the same permission with
`authenticator.requireAnyPermission(...)`.

## Data model

The appointment is the centre (spec §5). Preparation, meeting results, comments, change history
and change requests all hang off `appointments`; each appointment also appears as exactly one
`schedule_plans` row for the rep. Rescheduling moves the same appointment; only a re-booking after
cancellation creates a new one (`original_appointment_id`).

Guards that live in the database, not only in code:

- `schedule_plans_no_overlapping_appointments` — a GiST exclusion constraint: two live appointment
  plans of the same rep can never overlap (spec §2-11, "check again on save").
- `*_time_order` checks (`ends_at > starts_at`) and `comments_single_target`.
- `appointments.source_file_hash` is unique, so importing the same file twice cannot double-register.
- `outbound_emails.dedupe_key` is unique, so the appointment e-mail is sent only once (spec §2-13).

Settings that change over time are data: option lists (`option_items`, disabled never deleted),
notice settings and recipients per notice code (`notice_settings`, `notice_recipients`),
holidays (`calendar_days`), the sales area table (`sales_area_rules`).

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
