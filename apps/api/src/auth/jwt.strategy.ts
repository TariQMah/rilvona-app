import { Inject, Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AppConfig, APP_CONFIG } from "../config/env";
import { AuthUser } from "../common/auth-user";
import { unauthorized } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";

type AccessPayload = { sub: string; tv: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      user.deletedAt ||
      user.status === "DELETED" ||
      user.tokenVersion !== payload.tv
    ) {
      throw unauthorized("Your session is no longer valid");
    }
    return {
      id: user.id,
      role: user.role,
      collegeId: user.collegeId,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
