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

`appointments` is the source of truth for the rep and the time. The linked `schedule_plans` row is
its calendar view: booking, rescheduling and cancelling update both in one transaction, and the
schedule screen cannot edit a plan that belongs to an appointment (`AccessPolicy.canEditPlan`).

Imports keep their history row by row. `list_import_rows` records every row of a list file (raw
values, how it was judged, the company it became), so one company can come in on many lists; a
lead's "same company" decision merges the flagged copy into the existing company.
`appointment_source_files` links an existing-list appointment to its CSV and/or handover PDF.

Guards that live in the database, not only in code:

- `schedule_plans_no_overlapping_appointments` — a GiST exclusion constraint: two live appointment
  plans of the same rep can never overlap (spec §2-11, "check again on save").
- `*_time_order` checks (`ends_at > starts_at`) and `comments_single_target`.
- `appointments.source_fingerprint` (file hashes + CSV row) is unique, so the same imported record
  cannot register twice, while other rows of the same CSV still can.
- `outbound_emails.dedupe_key` is unique, so the appointment e-mail is sent only once (spec §2-13).

Settings that change over time are data: option lists (`option_items`, disabled never deleted),
notice settings and recipients per notice code (`notice_settings`, `notice_recipients`),
holidays (`calendar_days`), the sales area table (`sales_area_rules`), and who takes part in
allocation (`telemarketer_profiles`: allocation target or not, fixed territory, usual hours).

Telemarketing (priority 2): one `shifts` row per person per day (`WORK` with start, end and break,
or `OFF`; late start and early leave are just other times). The allocation rules live in
`domain/allocation/Allocator.ts` with no database: share = own working minutes ÷ everyone's,
remainders to the largest fractions, companies with the same name kept together, day-before checks
to the booker when they are working. `AllocationService` writes the day as `DRAFT` rows in
`allocations`; the lead moves rows and confirms (`CONFIRMED`, N11). Drafts are shown only to leads
and admins. Companies in someone's fixed territory are left out.

Scheduled jobs (`ScheduledJobs`, every minute, business days): N4, N19, N3, N12, N15 at their
configured times, N13 while switched on, and the morning allocation draft at the time in
`app_settings`. Each on-screen reminder carries a `notifications.dedupe_key`, so a restart or a
second instance never notifies twice. `apps.maintenance_mode` blocks everyone but admins
(503 `MAINTENANCE`; `/api/system/status` stays open so the web app can show the notice).

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
   `requireAuth()` and `requireAnyPermission(...)` (never role names).
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
