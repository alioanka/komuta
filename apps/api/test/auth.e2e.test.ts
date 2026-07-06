import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../src/auth/auth.service.js';

/**
 * DB-backed unit tests for AuthService refresh-token handling.
 * Requires DATABASE_URL (skipped automatically when unset).
 */
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

const prisma = new PrismaClient();
const auth = new AuthService(prisma as never, new JwtService({}));

const email = `refresh-test-${Date.now()}@komuta.test`;
let userId = '';

d('AuthService refresh token rotation (e2e)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email,
        fullName: 'Refresh Test',
        role: 'VIEWER',
        passwordHash: await argon2.hash('irrelevant-password', { type: argon2.argon2id }),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const authUser = () => ({
    id: userId,
    email,
    role: 'VIEWER' as const,
    permissions: [],
    scopeCompanyIds: [],
    scopeOutletIds: [],
    unscoped: false,
  });

  it('a valid refresh token rotates into a fresh pair', async () => {
    const pair = await auth.issueTokens(authUser());
    const next = await auth.refresh(pair.refreshToken);
    expect(next.accessToken).toBeTruthy();
    expect(next.refreshToken).toBeTruthy();
    expect(next.refreshToken).not.toBe(pair.refreshToken);
  });

  it('a rotated (used) refresh token is rejected and reuse revokes the family', async () => {
    const pair = await auth.issueTokens(authUser());
    const next = await auth.refresh(pair.refreshToken); // rotates pair.refreshToken
    // Reusing the old token must fail...
    await expect(auth.refresh(pair.refreshToken)).rejects.toThrow('Invalid refresh token');
    // ...and reuse detection revokes ALL active tokens, including the new one.
    await expect(auth.refresh(next.refreshToken)).rejects.toThrow('Invalid refresh token');
  });

  it('a refresh token no longer works after logout even though its JWT is unexpired', async () => {
    const pair = await auth.issueTokens(authUser());
    await auth.logout(userId);
    await expect(auth.refresh(pair.refreshToken)).rejects.toThrow('Invalid refresh token');
  });

  it('a signed token with an unknown jti is rejected', async () => {
    const jwt = new JwtService({});
    const forged = await jwt.signAsync(
      { sub: userId, jti: '00000000-0000-4000-8000-000000000000' },
      { secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me', expiresIn: '30d' },
    );
    await expect(auth.refresh(forged)).rejects.toThrow('Invalid refresh token');
  });

  it('a signed token without a jti is rejected', async () => {
    const jwt = new JwtService({});
    const legacy = await jwt.signAsync(
      { sub: userId },
      { secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me', expiresIn: '30d' },
    );
    await expect(auth.refresh(legacy)).rejects.toThrow('Invalid refresh token');
  });
});
