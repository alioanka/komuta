import { describe, it, expect } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../src/common/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../src/common/public.decorator.js';
import { ALLOW_TOKEN_QUERY_KEY } from '../src/common/allow-token-query.decorator.js';

/** Unit tests for JwtAuthGuard query-token support (SSE). No DB required. */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://unused/test';

const jwt = new JwtService({});
const SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';

function makeContext(
  req: Record<string, unknown>,
  flags: Partial<Record<string, boolean>>,
): ExecutionContext {
  const reflector = {
    getAllAndOverride: (key: string) => flags[key] ?? false,
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return Object.assign(ctx, { __reflector: reflector });
}

function makeGuard(flags: Partial<Record<string, boolean>>) {
  const reflector = { getAllAndOverride: (key: string) => flags[key] ?? false };
  return new JwtAuthGuard(reflector as never, jwt);
}

async function signAccess(sub: string) {
  return jwt.signAsync(
    {
      sub,
      email: 'sse@test',
      role: 'VIEWER',
      permissions: ['notification:read'],
      scopeCompanyIds: [],
      scopeOutletIds: [],
      unscoped: false,
    },
    { secret: SECRET, expiresIn: '5m' },
  );
}

describe('JwtAuthGuard ?token= support', () => {
  it('accepts a valid token via query param on an @AllowTokenQuery route', async () => {
    const token = await signAccess('u1');
    const guard = makeGuard({ [ALLOW_TOKEN_QUERY_KEY]: true });
    const req: Record<string, unknown> = { headers: {}, query: { token } };
    await expect(guard.canActivate(makeContext(req, {}))).resolves.toBe(true);
    expect((req.user as { id: string }).id).toBe('u1');
  });

  it('rejects a query token on routes without @AllowTokenQuery', async () => {
    const token = await signAccess('u1');
    const guard = makeGuard({});
    const req = { headers: {}, query: { token } };
    await expect(guard.canActivate(makeContext(req, {}))).rejects.toThrow('Missing bearer token');
  });

  it('rejects an invalid query token even on an @AllowTokenQuery route', async () => {
    const guard = makeGuard({ [ALLOW_TOKEN_QUERY_KEY]: true });
    const req = { headers: {}, query: { token: 'garbage' } };
    await expect(guard.canActivate(makeContext(req, {}))).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('Bearer header still works and takes precedence over the query param', async () => {
    const token = await signAccess('u2');
    const guard = makeGuard({ [ALLOW_TOKEN_QUERY_KEY]: true });
    const req: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
      query: { token: 'garbage' },
    };
    await expect(guard.canActivate(makeContext(req, {}))).resolves.toBe(true);
    expect((req.user as { id: string }).id).toBe('u2');
  });

  it('public routes bypass auth entirely', async () => {
    const guard = makeGuard({ [IS_PUBLIC_KEY]: true });
    await expect(guard.canActivate(makeContext({ headers: {} }, {}))).resolves.toBe(true);
  });
});
