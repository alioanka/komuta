import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { resolvePermissions, type Permission, type Role } from '@komuta/shared';
import { MAX_FAILED_LOGINS, LOCKOUT_DURATION_MS } from '@komuta/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadEnv } from '../config/env.js';
import type { AuthUser } from '../common/current-user.decorator.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /** Verify credentials, applying lockout policy. Returns the AuthUser claims. */
  async validateUser(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { scopes: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked');
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const failedLogins = user.failedLogins + 1;
      const lockedUntil =
        failedLogins >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins, lockedUntil },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return this.toAuthUser(user);
  }

  toAuthUser(user: {
    id: string;
    email: string;
    role: string;
    grantedPermissions: string[];
    revokedPermissions: string[];
    scopes: { companyId: string | null; outletId: string | null }[];
  }): AuthUser {
    const permissions = [
      ...resolvePermissions(
        user.role as Role,
        user.grantedPermissions as Permission[],
        user.revokedPermissions as Permission[],
      ),
    ];
    const unscoped = user.role === 'OWNER' || user.role === 'ADMIN';
    return {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      permissions,
      scopeCompanyIds: user.scopes.flatMap((s) => (s.companyId ? [s.companyId] : [])),
      scopeOutletIds: user.scopes.flatMap((s) => (s.outletId ? [s.outletId] : [])),
      unscoped,
    };
  }

  async issueTokens(user: AuthUser): Promise<TokenPair> {
    const env = loadEnv();
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        scopeCompanyIds: user.scopeCompanyIds,
        scopeOutletIds: user.scopeOutletIds,
        unscoped: user.unscoped,
      },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_TTL },
    );

    // The refresh JWT carries a jti that doubles as the RefreshToken row id,
    // giving O(1) revocation lookup on refresh.
    const tokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: tokenId },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_TTL },
    );
    const tokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify a refresh token, rotate it, and return a fresh pair.
   * The token must (a) carry a valid signature, (b) match a stored, non-revoked,
   * non-expired RefreshToken row (looked up by jti, verified against its argon2
   * hash), and (c) belong to an active user. The presented token is revoked on
   * use (rotation); reuse of an already-revoked token revokes the whole family.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const env = loadEnv();
    let payload: { sub: string; jti?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!payload.jti) throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      // Reuse of a rotated/revoked token → likely theft; revoke everything.
      await this.logout(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');

    const matches = await argon2.verify(stored.tokenHash, refreshToken).catch(() => false);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { scopes: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');

    // Revoke the presented token (rotation) — other sessions stay valid.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(this.toAuthUser(user));
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.hashPassword(next);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.logout(userId);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { scopes: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }
}
