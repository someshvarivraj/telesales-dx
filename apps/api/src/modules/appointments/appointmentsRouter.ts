import {
  appointmentListQuerySchema,
  cancelAppointmentRequestSchema,
  changeRequestRequestSchema,
  createAppointmentRequestSchema,
  dayBeforeCheckRequestSchema,
  dateString,
  meetingResultRequestSchema,
  meetingUrlRequestSchema,
  Permission,
  reportQuerySchema,
  rescheduleRequestSchema,
  updateAppointmentDetailsRequestSchema,
  updateEmailDraftRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { sendFile, uploadedFiles } from '../../http/sendFile.js';
import { uploadFiles } from '../../http/upload.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { AppointmentBookingService } from './AppointmentBookingService.js';
import type { AppointmentImportService } from './AppointmentImportService.js';
import type { AppointmentMailKind, AppointmentMailService } from './AppointmentMailService.js';
import type { AppointmentQueryService } from './AppointmentQueryService.js';
import type { AppointmentReportService } from './AppointmentReportService.js';
import type { AppointmentWorkService } from './AppointmentWorkService.js';

export interface AppointmentsDeps {
  authenticator: Authenticator;
  queries: AppointmentQueryService;
  booking: AppointmentBookingService;
  work: AppointmentWorkService;
  mail: AppointmentMailService;
  imports: AppointmentImportService;
  reports: AppointmentReportService;
}

const mailKind = z.enum(['booking', 'cancellation', 'dayBefore']);
const dayBeforeQuery = z.object({ date: dateString.optional() });
const changeRequestQuery = z.object({ open: z.enum(['true', 'false']).default('true') });
const prefillBody = z.object({ rowIndex: z.coerce.number().int().min(0).optional() });
const preparationBody = z.object({ note: z.string().trim().max(10_000).optional() });
const reportFilter = reportQuerySchema.extend({ bookedById: z.uuid().optional() });

function kindParam(value: unknown): AppointmentMailKind {
  return parseWith(mailKind, value);
}

/** Appointments: one record shared by ① and ② (spec §3). */
export function createAppointmentsRouter(deps: AppointmentsDeps): Router {
  const router = Router();
  const auth = deps.authenticator;
  const view = auth.requireAnyPermission(Permission.ViewData);
  const book = auth.requireAnyPermission(
    Permission.ManageTelemaAppointments,
    Permission.ManageSalesAppointments,
    Permission.Administer,
  );
  const telemaWork = auth.requireAnyPermission(
    Permission.HandleChangeRequests,
    Permission.Administer,
  );

  router.get('/appointments', view, async (req, res) => {
    res.json(await deps.queries.list(parseQuery(appointmentListQuerySchema, req)));
  });
  router.get('/appointments/report.xlsx', view, async (req, res) => {
    const query = parseQuery(reportFilter, req);
    const report = await deps.reports.build(query.bookedFrom, query.bookedTo, {
      bookedById: query.bookedById,
    });
    sendFile(
      res,
      {
        originalName: report.fileName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      report.content,
    );
  });
  router.get('/appointments/day-before', view, async (req, res) => {
    res.json(await deps.queries.dayBeforeList(parseQuery(dayBeforeQuery, req).date));
  });
  router.get('/change-requests', view, async (req, res) => {
    res.json(
      await deps.queries.changeRequests(parseQuery(changeRequestQuery, req).open === 'true'),
    );
  });
  router.post('/change-requests/:id/take', telemaWork, async (req, res) => {
    res.json(await deps.work.takeChangeRequest(currentUserOf(req), idParam(req)));
  });
  router.post('/change-requests/:id/done', telemaWork, async (req, res) => {
    res.json(await deps.work.completeChangeRequest(currentUserOf(req), idParam(req)));
  });
  router.post('/change-requests/:id/withdraw', view, async (req, res) => {
    res.json(await deps.work.withdrawChangeRequest(currentUserOf(req), idParam(req)));
  });

  router.post('/appointments/file-prefill', book, uploadFiles, async (req, res) => {
    const { rowIndex } = parseWith(prefillBody, req.body ?? {});
    res.json(
      await deps.imports.prefill(currentUserOf(req), uploadedFiles(req.files), rowIndex ?? null),
    );
  });
  router.post('/appointments', book, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.booking.create(
          currentUserOf(req),
          parseWith(createAppointmentRequestSchema, req.body),
        ),
      );
  });

  router.get('/appointments/:id', view, async (req, res) => {
    res.json(await deps.queries.detail(currentUserOf(req), idParam(req)));
  });
  router.put('/appointments/:id', book, async (req, res) => {
    res.json(
      await deps.booking.updateDetails(
        currentUserOf(req),
        idParam(req),
        parseWith(updateAppointmentDetailsRequestSchema, req.body),
      ),
    );
  });
  router.post('/appointments/:id/reschedule', book, async (req, res) => {
    res.json(
      await deps.booking.reschedule(
        currentUserOf(req),
        idParam(req),
        parseWith(rescheduleRequestSchema, req.body),
      ),
    );
  });
  router.post('/appointments/:id/cancel', book, async (req, res) => {
    res.json(
      await deps.booking.cancel(
        currentUserOf(req),
        idParam(req),
        parseWith(cancelAppointmentRequestSchema, req.body),
      ),
    );
  });
  router.post('/appointments/:id/confirm', view, async (req, res) => {
    res.json(await deps.work.confirm(currentUserOf(req), idParam(req)));
  });
  router.put('/appointments/:id/meeting-url', view, async (req, res) => {
    const { meetingUrl } = parseWith(meetingUrlRequestSchema, req.body);
    res.json(await deps.work.setMeetingUrl(currentUserOf(req), idParam(req), meetingUrl));
  });
  router.post('/appointments/:id/preparations', view, uploadFiles, async (req, res) => {
    const { note } = parseWith(preparationBody, req.body ?? {});
    res
      .status(201)
      .json(
        await deps.work.addPreparation(
          currentUserOf(req),
          idParam(req),
          note || null,
          uploadedFiles(req.files),
        ),
      );
  });
  router.get('/appointments/:id/files/:fileId', view, async (req, res) => {
    const { record, content } = await deps.work.preparationFile(
      idParam(req),
      idParam(req, 'fileId'),
    );
    sendFile(res, record, content, {
      inline: record.contentType === 'application/pdf' || record.contentType.startsWith('image/'),
    });
  });
  router.post('/appointments/:id/results', view, async (req, res) => {
    res
      .status(201)
      .json(
        await deps.work.addResult(
          currentUserOf(req),
          idParam(req),
          parseWith(meetingResultRequestSchema, req.body),
        ),
      );
  });
  router.post('/appointments/:id/change-requests', view, async (req, res) => {
    const { message } = parseWith(changeRequestRequestSchema, req.body);
    res.status(201).json(await deps.work.requestChange(currentUserOf(req), idParam(req), message));
  });
  router.put(
    '/appointments/:id/day-before',
    auth.requireAnyPermission(Permission.WriteDayBeforeChecks),
    async (req, res) => {
      res.json(
        await deps.work.recordDayBefore(
          currentUserOf(req),
          idParam(req),
          parseWith(dayBeforeCheckRequestSchema, req.body),
        ),
      );
    },
  );

  router.post('/appointments/:id/emails/:kind/draft', view, async (req, res) => {
    res.json(await deps.mail.draft(currentUserOf(req), idParam(req), kindParam(req.params.kind)));
  });
  router.post('/appointments/:id/emails/booking/resend', view, async (req, res) => {
    res.json(await deps.mail.resendBooking(currentUserOf(req), idParam(req)));
  });
  router.put('/appointments/:id/emails/:emailId', view, async (req, res) => {
    res.json(
      await deps.mail.update(
        currentUserOf(req),
        idParam(req),
        idParam(req, 'emailId'),
        parseWith(updateEmailDraftRequestSchema, req.body),
      ),
    );
  });
  router.post('/appointments/:id/emails/:emailId/regenerate', view, async (req, res) => {
    res.json(await deps.mail.regenerate(currentUserOf(req), idParam(req), idParam(req, 'emailId')));
  });
  router.post('/appointments/:id/emails/:emailId/send', view, async (req, res) => {
    res.json(await deps.mail.send(currentUserOf(req), idParam(req), idParam(req, 'emailId')));
  });
  return router;
}
