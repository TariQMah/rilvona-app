import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { AuthUser } from "../common/auth-user";
import {
  ALLOW_DEACTIVATED,
  IS_PUBLIC,
  ROLES_KEY,
  VERIFIED_KEY,
} from "../common/decorators";
import { AppError, forbidden, unauthorized } from "../common/errors";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    if (isPublic && !request.headers.authorization) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error ? err : unauthorized();
    }
    return user;
  }
}

@Injectable()
export class AccountStatusGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || user.status === "DELETED") throw unauthorized();
    if (user.status === "DEACTIVATED") {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_DEACTIVATED,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed)
        throw new AppError(
          403,
          "ACCOUNT_DEACTIVATED",
          "This account is deactivated",
        );
    }
    const needsVerification = this.reflector.getAllAndOverride<boolean>(
      VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (needsVerification && !user.emailVerified) {
      throw new AppError(
        403,
        "EMAIL_UNVERIFIED",
        "Verify your email to continue",
      );
    }
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) throw forbidden();
    return true;
  }
}
