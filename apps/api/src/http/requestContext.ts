import type { Request } from 'express';
import type { RequestContext } from '../domain/audit/AuditLogger.js';

export function requestContextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}
