import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './current-user.decorator.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records every mutating request to the AuditLog. Intentionally best-effort:
 * audit failures must never block the actual operation.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!MUTATING.has(method)) return next.handle();

    // Skip auth endpoints to avoid logging credentials.
    const path: string = req.originalUrl ?? req.url ?? '';
    if (path.startsWith('/auth/login') || path.startsWith('/auth/refresh')) {
      return next.handle();
    }

    const user = req.user as AuthUser | undefined;
    const ip: string | undefined = req.ip ?? req.headers?.['x-forwarded-for'];

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : undefined;
        void this.prisma.auditLog
          .create({
            data: {
              actorUserId: user?.id ?? null,
              action: method,
              entity: path.split('?')[0] ?? path,
              entityId,
              after: undefined,
              ip: ip ?? null,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
