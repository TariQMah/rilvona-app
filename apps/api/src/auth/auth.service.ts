import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { JwtService } from "@nestjs/jwt";
import { OtpPurpose, Prisma, User } from "@prisma/client";
import {
  GoogleSignInInput,
  isReservedUsername,
  PRIVACY_VERSION,
  TERMS_VERSION,
  RegisterInput,
  usernameSchema,
} from "@hiihive/contracts";
import { RequestMeta } from "../common/auth-user";
import { AppError, conflict, notFound, unauthorized } from "../common/errors";
import { RateLimitService } from "../common/rate-limiter";
import { AppConfig, APP_CONFIG } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password";

const MAX_FAILED_LOGINS = 8;
const LOCK_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly limits: RateLimitService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.dummyHash = hashPassword("not-a-real-password");
    this.google = new OAuth2Client();
  }

  private readonly google: OAuth2Client;

  /** The old email and password routes stay off unless they are switched on (tests and local work only). */
  assertPasswordAuth() {
    if (!this.config.passwordAuthEnabled) throw notFound("Not found");
  }

  /** Checks a Google ID token against our own client ids. Kept separate so tests can stand in for Google. */
  protected async verifyGoogleToken(idToken: string) {
    if (this.config.googleClientIds.length === 0) {
      throw new AppError(
        503,
        "GOOGLE_NOT_CONFIGURED",
        "Google sign in is not available right now",
      );
    }
    try {
      const ticket = await this.google.verifyIdToken({
        idToken,
        audience: this.config.googleClientIds,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) throw new Error("missing claims");
      return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: payload.name?.trim() ?? "",
      };
    } catch {
      throw unauthorized("Google could not confirm that sign in. Try again.");
    }
  }

  /** The single way in: signs an existing student in, or creates the account the first time their Google account is seen. */
  async googleSignIn(input: GoogleSignInInput, meta: RequestMeta) {
    await this.limits.consume(
      `google:${meta.ip ?? "unknown"}`,
      20,
      60_000,
      "Too many sign in attempts. Wait a minute.",
    );
    const identity = await this.verifyGoogleToken(input.idToken);
    if (!identity.emailVerified) {
      throw unauthorized("That Google account has no verified email");
    }

    let user = await this.prisma.user.findUnique({
      where: { googleId: identity.sub },
      include: { profile: true },
    });
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: identity.email },
        include: { profile: true },
      });
      if (user?.googleId && user.googleId !== identity.sub) {
        throw conflict(
          "GOOGLE_ACCOUNT_MISMATCH",
          "That email already belongs to a different Google account",
        );
      }
    }
    if (user?.status === "DELETED") throw unauthorized("Sign in required");

    if (user) {
      const wasDeactivated = user.status === "DEACTIVATED";
      // Google has proved the address, so a first Google sign in also claims an older account for that address.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: identity.sub,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          ...(user.status === "DEACTIVATED"
            ? { status: "ACTIVE", deactivatedAt: null }
            : {}),
        },
        include: { profile: true },
      });
      if (wasDeactivated) {
        await this.audit(user.id, "ACCOUNT_REACTIVATED", "USER", user.id, meta);
      }
    } else {
      user = await this.createGoogleUser(identity);
    }

    const accepted = await this.prisma.consentRecord.findFirst({
      where: {
        userId: user.id,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      },
      select: { id: true },
    });
    if (!accepted) {
      await this.prisma.consentRecord.create({
        data: {
          userId: user.id,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
      });
    }

    return {
      user: this.privateUser(user),
      tokens: await this.issueTokens(user, meta),
    };
  }

  private async createGoogleUser(identity: {
    sub: string;
    email: string;
    name: string;
  }) {
    const displayName =
      (identity.name || identity.email.split("@")[0]).slice(0, 40).trim() ||
      "Student";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const username = await this.freeUsername(identity.email, attempt);
      try {
        return await this.prisma.user.create({
          data: {
            email: identity.email,
            googleId: identity.sub,
            emailVerifiedAt: new Date(),
            role: "STUDENT",
            profile: {
              create: {
                displayName: displayName.length >= 2 ? displayName : "Student",
                username,
              },
            },
            notificationPrefs: { create: {} },
          },
          include: { profile: true },
        });
      } catch (error) {
        const raced =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          JSON.stringify(error.meta?.target ?? "")
            .toLowerCase()
            .includes("username");
        if (!raced) throw error;
      }
    }
    throw conflict("USERNAME_IN_USE", "Could not pick a username. Try again.");
  }

  /** A readable starting username from the email (ada.lovelace@x.edu -> ada_lovelace), made unique when it is taken. */
  private async freeUsername(email: string, attempt: number) {
    let base = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 14);
    if (base.length < 3) base = `${base}student`.slice(0, 14);
    const candidate =
      attempt === 0
        ? base
        : `${base}_${randomInt(0, 10_000).toString().padStart(4, "0")}`;
    const taken =
      isReservedUsername(candidate) ||
      (await this.prisma.userProfile.findFirst({
        where: { username: { equals: candidate, mode: "insensitive" } },
        select: { userId: true },
      }));
    return taken
      ? `${base}_${randomInt(0, 10_000).toString().padStart(4, "0")}`
      : candidate;
  }

  async register(input: RegisterInput, meta: RequestMeta) {
    await this.limits.consume(
      `register:${meta.ip ?? "unknown"}`,
      10,
      60 * 60 * 1000,
      "Too many signups from this network",
    );
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          {
            profile: {
              username: { equals: input.username, mode: "insensitive" },
            },
          },
        ],
      },
      include: { profile: true },
    });
    if (isReservedUsername(input.username)) {
      throw conflict("USERNAME_IN_USE", "That username is reserved");
    }
    if (existing?.email === input.email)
      throw conflict("EMAIL_IN_USE", "An account already uses that email");
    if (existing) throw conflict("USERNAME_IN_USE", "That username is taken");

    // Two people can pick the same name at the same moment: the database's unique indexes decide, and the loser gets
    // the same clear answer as above instead of a server error.
    const user = await this.prisma.user
      .create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
          role: "STUDENT",
          profile: {
            create: {
              displayName: input.displayName,
              username: input.username,
            },
          },
          notificationPrefs: { create: {} },
          consents: {
            create: {
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
            },
          },
        },
        include: { profile: true },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const target = JSON.stringify(error.meta?.target ?? "").toLowerCase();
          if (target.includes("email"))
            throw conflict(
              "EMAIL_IN_USE",
              "An account already uses that email",
            );
          throw conflict("USERNAME_IN_USE", "That username is taken");
        }
        throw error;
      });
    const devOtp = await this.issueOtp(user.id, "EMAIL_VERIFY", user.email);
    const tokens = await this.issueTokens(user, meta);
    return {
      user: this.privateUser(user),
      tokens,
      ...(devOtp ? { devOtp } : {}),
    };
  }

  /** Lets the sign-up form say "taken" while the student is still typing. Rate limited, and it reveals names only. */
  async usernameAvailable(raw: string, meta: RequestMeta) {
    await this.limits.consume(
      `username-check:${meta.ip ?? "unknown"}`,
      60,
      60_000,
      "Too many checks. Wait a minute.",
    );
    const parsed = usernameSchema.safeParse(raw);
    if (!parsed.success) {
      const reserved = isReservedUsername(String(raw ?? ""));
      return { available: false, reason: reserved ? "reserved" : "invalid" };
    }
    const taken = await this.prisma.userProfile.findFirst({
      where: { username: { equals: parsed.data, mode: "insensitive" } },
      select: { userId: true },
    });
    return taken ? { available: false, reason: "taken" } : { available: true };
  }

  /**
   * Email and password sign in for the admin panel only. It works for platform admins and nobody else, and it stays
   * available when the student-facing password routes are switched off.
   */
  adminLogin(email: string, password: string, meta: RequestMeta) {
    return this.login(email, password, meta, true);
  }

  async login(
    email: string,
    password: string,
    meta: RequestMeta,
    adminOnly = false,
  ) {
    await this.limits.consume(
      `${adminOnly ? "admin-login" : "login"}:${meta.ip ?? "unknown"}`,
      10,
      60_000,
      "Too many login attempts. Wait a minute.",
    );
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        423,
        "ACCOUNT_LOCKED",
        "This account is temporarily locked",
      );
    }
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : await verifyPassword(await this.dummyHash, password).then(() => false);
    const roleAllowed = !adminOnly || user?.role === "PLATFORM_ADMIN";
    if (!user || !valid || !roleAllowed || user.status === "DELETED") {
      if (user && user.status !== "DELETED") await this.recordFailure(user.id);
      throw unauthorized("Email or password is incorrect");
    }
    if (user.status === "DEACTIVATED") {
      throw new AppError(
        403,
        "ACCOUNT_DEACTIVATED",
        "This account is deactivated. Reactivate it to continue.",
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return {
      user: this.privateUser(user),
      tokens: await this.issueTokens(user, meta),
    };
  }

  async reactivate(email: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, password)
      : false;
    if (!user || !valid || user.status === "DELETED")
      throw unauthorized("Email or password is incorrect");
    if (user.status !== "DEACTIVATED")
      throw new AppError(
        409,
        "ACCOUNT_ACTIVE",
        "This account is already active",
      );
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        deactivatedAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      include: { profile: true },
    });
    await this.audit(user.id, "ACCOUNT_REACTIVATED", "USER", user.id, meta);
    return {
      user: this.privateUser(updated),
      tokens: await this.issueTokens(updated, meta),
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshTokenSession.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } },
    });
    if (
      !session ||
      session.user.status === "DELETED" ||
      session.user.deletedAt
    ) {
      throw unauthorized("That session is no longer valid");
    }
    if (session.revokedAt) {
      await this.prisma.refreshTokenSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(
        session.userId,
        "REFRESH_REUSE",
        "SESSION",
        session.familyId,
        meta,
      );
      throw new AppError(
        401,
        "REFRESH_REUSE",
        "This session was revoked because a refresh token was reused",
      );
    }
    if (session.expiresAt <= new Date())
      throw unauthorized("That session has expired");
    const claimed = await this.prisma.refreshTokenSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.prisma.refreshTokenSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError(
        401,
        "REFRESH_REUSE",
        "This session was revoked because a refresh token was reused",
      );
    }
    const tokens = await this.issueTokens(session.user, meta, session.familyId);
    await this.prisma.refreshTokenSession.update({
      where: { id: session.id },
      data: { replacedById: tokens.sessionId },
    });
    return {
      user: this.privateUser(session.user),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshTokenSession.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.$transaction([
      this.prisma.refreshTokenSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
    return { revoked: true };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    if (user.emailVerifiedAt) return { sent: true };
    await this.limits.consume(
      `otp:${user.id}`,
      5,
      10 * 60 * 1000,
      "Too many verification messages. Try again later.",
    );
    const devOtp = await this.issueOtp(user.id, "EMAIL_VERIFY", user.email);
    return { sent: true, ...(devOtp ? { devOtp } : {}) };
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user)
      throw new AppError(400, "OTP_INVALID", "That code is invalid or expired");
    await this.consumeOtp(user.id, "EMAIL_VERIFY", code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  async forgotPassword(email: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status === "DELETED") return { sent: true };
    await this.limits.consume(
      `reset:${user.id}`,
      5,
      10 * 60 * 1000,
      "Too many reset messages. Try again later.",
    );
    const devOtp = await this.issueOtp(user.id, "PASSWORD_RESET", user.email);
    await this.audit(
      user.id,
      "PASSWORD_RESET_REQUESTED",
      "USER",
      user.id,
      meta,
    );
    return { sent: true, ...(devOtp ? { devOtp } : {}) };
  }

  async resetPassword(
    email: string,
    code: string,
    password: string,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status === "DELETED")
      throw new AppError(400, "OTP_INVALID", "That code is invalid or expired");
    await this.consumeOtp(user.id, "PASSWORD_RESET", code);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          tokenVersion: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.refreshTokenSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit(user.id, "PASSWORD_RESET", "USER", user.id, meta);
    return { reset: true };
  }

  private async recordFailure(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + LOCK_MS),
          failedLoginCount: 0,
        },
      });
    }
  }

  private async issueOtp(userId: string, purpose: OtpPurpose, email: string) {
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.otpChallenge.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpChallenge.create({
      data: {
        userId,
        purpose,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    if (this.config.nodeEnv !== "production") {
      console.info(`[hiihive mail] to=${email} purpose=${purpose}`);
    }
    return this.config.exposeOtp ? code : undefined;
  }

  private async consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        userId,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.attempts >= 5) {
      throw new AppError(400, "OTP_INVALID", "That code is invalid or expired");
    }
    const expected = Buffer.from(challenge.codeHash);
    const actual = Buffer.from(this.hashCode(code));
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!matches) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppError(400, "OTP_INVALID", "That code is invalid or expired");
    }
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  private async issueTokens(
    user: User,
    meta: RequestMeta,
    familyId: string = randomUUID(),
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, tv: user.tokenVersion },
      {
        secret: this.config.jwtAccessSecret,
        expiresIn: this.config.jwtAccessTtlSeconds,
      },
    );
    const refreshToken = randomBytes(32).toString("base64url");
    const session = await this.prisma.refreshTokenSession.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + this.config.jwtRefreshTtlSeconds * 1000,
        ),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 200),
      },
    });
    return { accessToken, refreshToken, sessionId: session.id };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashCode(code: string) {
    return createHmac("sha256", this.config.otpSecret)
      .update(code)
      .digest("hex");
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    meta: RequestMeta,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        ip: meta.ip,
        metadata: meta.userAgent
          ? { userAgent: meta.userAgent.slice(0, 200) }
          : undefined,
      },
    });
  }

  private privateUser(
    user: User & { profile: { displayName: string; username: string } | null },
  ) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      collegeId: user.collegeId,
      emailVerified: Boolean(user.emailVerifiedAt),
      displayName: user.profile?.displayName ?? "",
      username: user.profile?.username ?? "",
    };
  }
}

export type AuthAuditMetadata = Prisma.InputJsonObject;
