import {
  appSettingsRequestSchema,
  areaRuleRequestSchema,
  calendarYearQuerySchema,
  companyGroupRequestSchema,
  companyHolidayRequestSchema,
  createAppRequestSchema,
  createUserRequestSchema,
  dateString,
  noticeRecipientRequestSchema,
  optionRequestSchema,
  Permission,
  updateAppRequestSchema,
  updateNoticeRequestSchema,
  updateOptionRequestSchema,
  updateUserRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { AuditAction, type AuditLogger } from '../../domain/audit/AuditLogger.js';
import { currentUserOf } from '../../http/currentUser.js';
import { NotFoundError } from '../../http/errors/AppError.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { uploadSingleFile } from '../../http/upload.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { AppService } from '../apps/AppService.js';
import type { AreaTableService } from '../area/AreaTableService.js';
import type { CalendarService } from '../calendar/CalendarService.js';
import type { OptionService } from '../options/OptionService.js';
import type { SlotGuard } from '../schedule/SlotGuard.js';
import type { SettingsService } from '../settings/SettingsService.js';
import type { AdminUserService } from './AdminUserService.js';
import type { NoticeSettingsService } from './NoticeSettingsService.js';

export interface AdminDeps {
  authenticator: Authenticator;
  users: AdminUserService;
  options: OptionService;
  calendar: CalendarService;
  notices: NoticeSettingsService;
  area: AreaTableService;
  guard: SlotGuard;
  settings: SettingsService;
  apps: AppService;
  audit: AuditLogger;
}

const auditQuery = z.object({
  targetType: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
const noticeCodeParam = z.string().regex(/^N\d{1,2}$/);

/** Admin screens (spec §6). The area table is also open to the person entrusted with it. */
const appKeyParam = z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/);

export function createAdminRouter(deps: AdminDeps): Router {
  const router = Router();
  const auth = deps.authenticator;
  const admin = auth.requireAnyPermission(Permission.Administer);
  const areaEditor = auth.requireAnyPermission(Permission.Administer, Permission.EditAreaTable);

  router.get('/users', admin, async (_req, res) => {
    res.json(await deps.users.list());
  });
  router.post('/users', admin, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.users.create(currentUserOf(req), parseWith(createUserRequestSchema, req.body)),
      );
  });
  router.put('/users/:id', admin, async (req, res) => {
    res.json(
      await deps.users.update(
        currentUserOf(req),
        idParam(req),
        parseWith(updateUserRequestSchema, req.body),
      ),
    );
  });
  router.post('/users/:id/reset-password', admin, async (req, res) => {
    res.json(await deps.users.resetPassword(currentUserOf(req), idParam(req)));
  });
  router.post('/users/:id/unlock', admin, async (req, res) => {
    res.json(await deps.users.unlock(currentUserOf(req), idParam(req)));
  });

  router.get('/options', admin, async (_req, res) => {
    res.json(await deps.options.list(true));
  });
  router.post('/options', admin, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.options.create(currentUserOf(req), parseWith(optionRequestSchema, req.body)),
      );
  });
  router.put('/options/:id', admin, async (req, res) => {
    res.json(
      await deps.options.update(
        currentUserOf(req),
        idParam(req),
        parseWith(updateOptionRequestSchema, req.body),
      ),
    );
  });

  router.get('/calendar', admin, async (req, res) => {
    const { year } = parseQuery(calendarYearQuerySchema, req);
    res.json(await deps.calendar.listRange(`${year}-01-01`, `${year}-12-31`));
  });
  router.post('/calendar/company-holidays', admin, async (req, res) => {
    const input = parseWith(companyHolidayRequestSchema, req.body);
    res
      .status(201)
      .json(await deps.calendar.addCompanyHoliday(currentUserOf(req), input.date, input.name));
  });
  router.delete('/calendar/company-holidays/:date', admin, async (req, res) => {
    await deps.calendar.removeCompanyHoliday(
      currentUserOf(req),
      parseWith(dateString, req.params.date),
    );
    res.status(204).end();
  });
  router.post('/calendar/public-holidays', admin, uploadSingleFile, async (req, res) => {
    const { year } = parseWith(calendarYearQuerySchema, req.body ?? {});
    res.json(await deps.calendar.importPublicHolidays(currentUserOf(req), year, req.file?.buffer));
  });

  router.get('/notices', admin, async (_req, res) => {
    res.json(await deps.notices.list());
  });
  router.put('/notices/:code', admin, async (req, res) => {
    const code = parseWith(noticeCodeParam, req.params.code);
    res.json(
      await deps.notices.update(
        currentUserOf(req),
        code,
        parseWith(updateNoticeRequestSchema, req.body),
      ),
    );
  });
  router.post('/notices/:code/recipients', admin, async (req, res) => {
    const code = parseWith(noticeCodeParam, req.params.code);
    res
      .status(201)
      .json(
        await deps.notices.addRecipient(
          currentUserOf(req),
          code,
          parseWith(noticeRecipientRequestSchema, req.body),
        ),
      );
  });
  router.delete('/notices/:code/recipients/:id', admin, async (req, res) => {
    const code = parseWith(noticeCodeParam, req.params.code);
    res.json(await deps.notices.removeRecipient(currentUserOf(req), code, idParam(req)));
  });

  router.get('/area-rules', areaEditor, async (_req, res) => {
    res.json(await deps.area.listRules());
  });
  router.post('/area-rules', areaEditor, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.area.createRule(currentUserOf(req), parseWith(areaRuleRequestSchema, req.body)),
      );
  });
  router.put('/area-rules/:id', areaEditor, async (req, res) => {
    res.json(
      await deps.area.updateRule(
        currentUserOf(req),
        idParam(req),
        parseWith(areaRuleRequestSchema, req.body),
      ),
    );
  });
  router.delete('/area-rules/:id', areaEditor, async (req, res) => {
    await deps.area.deleteRule(currentUserOf(req), idParam(req));
    res.status(204).end();
  });
  router.get('/company-groups', areaEditor, async (_req, res) => {
    res.json(await deps.area.listGroups());
  });
  router.post('/company-groups', areaEditor, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.area.saveGroup(
          currentUserOf(req),
          null,
          parseWith(companyGroupRequestSchema, req.body),
        ),
      );
  });
  router.put('/company-groups/:id', areaEditor, async (req, res) => {
    res.json(
      await deps.area.saveGroup(
        currentUserOf(req),
        idParam(req),
        parseWith(companyGroupRequestSchema, req.body),
      ),
    );
  });

  router.get('/slot-locks', admin, async (req, res) => {
    res.json(await deps.guard.activeLocks(currentUserOf(req).id));
  });
  router.delete('/slot-locks/:id', admin, async (req, res) => {
    const released = await deps.guard.forceRelease(idParam(req));
    if (!released) {
      throw new NotFoundError();
    }
    await deps.audit.record({
      action: AuditAction.LockReleased,
      actorUserId: currentUserOf(req).id,
      targetType: 'slot_lock',
      targetId: released.id,
      before: {
        salesRep: released.salesRep.name,
        lockedBy: released.lockedBy.name,
        startsAt: released.startsAt,
      },
    });
    res.status(204).end();
  });

  router.get('/settings', admin, async (_req, res) => {
    res.json(await deps.settings.get());
  });
  router.put('/settings', admin, async (req, res) => {
    res.json(
      await deps.settings.update(currentUserOf(req), parseWith(appSettingsRequestSchema, req.body)),
    );
  });

  router.get('/apps', admin, async (_req, res) => {
    res.json(await deps.apps.list());
  });
  router.post('/apps', admin, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.apps.create(currentUserOf(req), parseWith(createAppRequestSchema, req.body)),
      );
  });
  router.put('/apps/:key', admin, async (req, res) => {
    const key = parseWith(appKeyParam, req.params.key);
    res.json(
      await deps.apps.update(currentUserOf(req), key, parseWith(updateAppRequestSchema, req.body)),
    );
  });

  router.get('/audit-logs', admin, async (req, res) => {
    res.json(await deps.notices.auditLog(parseQuery(auditQuery, req)));
  });

  router.use(() => {
    throw new NotFoundError();
  });
  return router;
}
