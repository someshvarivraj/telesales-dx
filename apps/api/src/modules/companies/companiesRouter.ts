import {
  commitListImportRequestSchema,
  companySearchRequestSchema,
  createCallRecordRequestSchema,
  createCommentRequestSchema,
  findRepRequestSchema,
  listImportRowsQuerySchema,
  Permission,
  resolveFlagRequestSchema,
  updateCompanyRequestSchema,
} from '@telesales/shared';
import { Router } from 'express';
import { z } from 'zod';
import { currentUserOf } from '../../http/currentUser.js';
import { ValidationError } from '../../http/errors/AppError.js';
import type { Authenticator } from '../../http/middleware/Authenticator.js';
import { sendFile } from '../../http/sendFile.js';
import { uploadSingleFile } from '../../http/upload.js';
import { idParam, parseQuery, parseWith } from '../../http/validate.js';
import type { AreaTableService } from '../area/AreaTableService.js';
import type { CallRecordService } from '../callRecords/CallRecordService.js';
import type { CommentService } from '../comments/CommentService.js';
import type { FileService } from '../files/FileService.js';
import type { CompanyService } from './CompanyService.js';
import type { ListImportService } from './ListImportService.js';

export interface CompaniesDeps {
  authenticator: Authenticator;
  companies: CompanyService;
  imports: ListImportService;
  callRecords: CallRecordService;
  comments: CommentService;
  area: AreaTableService;
  files: FileService;
}

const commentQuery = z.object({
  appointmentId: z.uuid().optional(),
  callRecordId: z.uuid().optional(),
});

/** ① Call status sharing: company register, list imports, call records, comments. */
export function createCompaniesRouter(deps: CompaniesDeps): Router {
  const router = Router();
  const auth = deps.authenticator;
  const view = auth.requireAnyPermission(Permission.ViewData);

  router.post('/companies/search', view, async (req, res) => {
    res.json(
      await deps.companies.search(
        parseWith(companySearchRequestSchema, req.body),
        currentUserOf(req).id,
      ),
    );
  });
  router.get('/companies/industries', view, async (_req, res) => {
    res.json(await deps.companies.industries());
  });
  router.get('/companies/list-names', view, async (_req, res) => {
    res.json(await deps.companies.listNames());
  });
  router.get(
    '/companies/flagged',
    auth.requireAnyPermission(Permission.ResolveDuplicates),
    async (_req, res) => {
      res.json(await deps.companies.listFlagged());
    },
  );
  router.post('/companies/find-rep', view, async (req, res) => {
    res.json(await deps.area.findRep(parseWith(findRepRequestSchema, req.body)));
  });
  router.get('/companies/:id', view, async (req, res) => {
    res.json(await deps.companies.get(idParam(req)));
  });
  router.put(
    '/companies/:id',
    auth.requireAnyPermission(Permission.EditCompanies),
    async (req, res) => {
      res.json(
        await deps.companies.update(
          currentUserOf(req),
          idParam(req),
          parseWith(updateCompanyRequestSchema, req.body),
        ),
      );
    },
  );
  router.post(
    '/companies/:id/resolve-flag',
    auth.requireAnyPermission(Permission.ResolveDuplicates),
    async (req, res) => {
      res.json(
        await deps.companies.resolveFlag(
          currentUserOf(req),
          idParam(req),
          parseWith(resolveFlagRequestSchema, req.body),
        ),
      );
    },
  );

  router.get('/companies/:id/call-records', view, async (req, res) => {
    res.json(await deps.callRecords.listForCompany(currentUserOf(req), idParam(req)));
  });
  router.post(
    '/companies/:id/call-records',
    auth.requireAnyPermission(Permission.WriteCallRecords),
    async (req, res) => {
      const record = await deps.callRecords.create(
        currentUserOf(req),
        idParam(req),
        parseWith(createCallRecordRequestSchema, req.body),
      );
      res.status(201).json(record);
    },
  );
  router.put(
    '/call-records/:id',
    auth.requireAnyPermission(Permission.WriteCallRecords),
    async (req, res) => {
      res.json(
        await deps.callRecords.update(
          currentUserOf(req),
          idParam(req),
          parseWith(createCallRecordRequestSchema, req.body),
        ),
      );
    },
  );

  router.get('/list-imports', view, async (_req, res) => {
    res.json(await deps.imports.list());
  });
  router.post(
    '/list-imports/preview',
    auth.requireAnyPermission(Permission.ImportLists),
    uploadSingleFile,
    async (req, res) => {
      if (!req.file) {
        throw new ValidationError({ file: ['required'] });
      }
      res.json(await deps.imports.preview(currentUserOf(req), req.file));
    },
  );
  router.post(
    '/list-imports',
    auth.requireAnyPermission(Permission.ImportLists),
    async (req, res) => {
      res
        .status(201)
        .json(
          await deps.imports.commit(
            currentUserOf(req),
            parseWith(commitListImportRequestSchema, req.body),
          ),
        );
    },
  );
  // Raw rows can hold more than the register shows, so only those who import or resolve see them.
  router.get(
    '/list-imports/:id/rows',
    auth.requireAnyPermission(Permission.ImportLists, Permission.ResolveDuplicates),
    async (req, res) => {
      res.json(await deps.imports.rows(idParam(req), parseQuery(listImportRowsQuerySchema, req)));
    },
  );
  router.get(
    '/list-imports/:id/file',
    auth.requireAnyPermission(Permission.ImportLists),
    async (req, res) => {
      const list = (await deps.imports.list()).find((item) => item.id === idParam(req));
      if (!list) {
        throw new ValidationError({ id: ['not_found'] });
      }
      const { record, content } = await deps.files.read(list.fileId);
      sendFile(res, record, content);
    },
  );

  router.get('/comments', view, async (req, res) => {
    res.json(await deps.comments.list(parseQuery(commentQuery, req)));
  });
  router.post(
    '/comments',
    auth.requireAnyPermission(Permission.WriteComments),
    async (req, res) => {
      res
        .status(201)
        .json(
          await deps.comments.create(
            currentUserOf(req),
            parseWith(createCommentRequestSchema, req.body),
          ),
        );
    },
  );

  return router;
}
