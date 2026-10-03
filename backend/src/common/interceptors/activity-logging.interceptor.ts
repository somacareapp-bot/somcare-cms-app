import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLog } from '../../activity-log/activity-log.entity';

const LOGGED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Route segments that read as a specific action rather than a plain create/update/delete,
// e.g. PATCH .../purchases/:id/confirm -> action 'confirm' instead of 'update'.
const VERB_SEGMENTS: Record<string, string> = {
  confirm: 'confirmed', cancel: 'cancelled', restock: 'restocked', issue: 'issued',
  dispense: 'dispensed', approve: 'approved', reject: 'rejected', login: 'logged in to',
  logout: 'logged out of', payment: 'recorded a payment on', 'mark-paid': 'marked paid',
  'dept-head-review': 'reviewed (dept head)', 'admin-review': 'reviewed (admin)',
};

const UUID_OR_NUMERIC_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d+$/i;

/**
 * Writes one ActivityLog row for every successful mutating request (POST/PATCH/PUT/DELETE),
 * so the monthly Staff activity report has something to read. Registered once as a global
 * interceptor (see activity-logging.module.ts) -- no per-controller wiring needed.
 *
 * Never blocks or fails the actual request: logging errors are swallowed.
 */
@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogsRepo: Repository<ActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!LOGGED_METHODS.has(method)) return next.handle();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.record(req, method, response).catch(() => {
            /* logging must never break the real request */
          });
        },
      }),
    );
  }

  // req.user.roles is an array of plain strings on most routes (from the JWT payload),
  // but on the login route itself it's still the raw Role[] entities -- handle both.
  private roleNames(roles: unknown): string | null {
    if (!Array.isArray(roles) || !roles.length) return null;
    return roles
      .map((r: any) => (typeof r === 'string' ? r : r?.name ?? r?.displayName ?? null))
      .filter(Boolean)
      .join(', ') || null;
  }

  private async record(req: any, method: string, response: any) {
    const user = req.user;
    if (!user?.id) return; // unauthenticated routes are skipped

    const rawPath: string = String(req.originalUrl || req.url || '').split('?')[0];
    const segments = rawPath.split('/').filter(Boolean).filter((s) => s !== 'api');
    if (!segments.length) return;

    const isIdSeg = (s: string) => UUID_OR_NUMERIC_RE.test(s);

    // entityType: the module segment plus one sub-resource segment, e.g.
    // /inventory/lab-supplies/:id -> 'inventory-lab-supplies'
    const typeParts = [segments[0]];
    if (segments[1] && !isIdSeg(segments[1])) typeParts.push(segments[1]);
    const entityType = typeParts.join('-');

    const last = segments[segments.length - 1];
    const verb = VERB_SEGMENTS[last];

    let action: string;
    let actionPhrase: string;
    if (verb) {
      action = last;
      actionPhrase = verb;
    } else if (method === 'DELETE') {
      action = 'delete';
      actionPhrase = 'deleted';
    } else if (method === 'POST') {
      action = 'create';
      actionPhrase = 'created';
    } else {
      action = 'update';
      actionPhrase = 'updated';
    }

    const idSeg = [...segments].reverse().find(isIdSeg);
    const entityId = idSeg ?? req.params?.id ?? response?.id ?? null;

    const who = user.fullName || user.username || 'A user';
    const what = entityType.replace(/-/g, ' ');
    const description = `${who} ${actionPhrase} ${what}`;

    await this.activityLogsRepo.save(
      this.activityLogsRepo.create({
        userId: user.id,
        userName: user.fullName ?? user.username ?? null,
        userRole: this.roleNames(user.roles),
        action,
        entityType,
        entityId: entityId != null ? String(entityId) : null,
        description,
        ipAddress: req.ip ?? null,
      }),
    );
  }
}
