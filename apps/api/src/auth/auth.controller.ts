import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  GoogleSignInInput,
  googleSignInSchema,
  loginSchema,
  reactivateSchema,
  RegisterInput,
  registerSchema,
  requestEmailSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@hiihive/contracts";
import { Request } from "express";
import { AllowDeactivated, Public } from "../common/decorators";
import { AuthUser } from "../common/auth-user";
import { CurrentUser } from "../common/current-user.decorator";
import { AppError } from "../common/errors";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post("google")
  google(
    @Body(new ZodPipe(googleSignInSchema)) body: GoogleSignInInput,
    @Req() req: Request,
  ) {
    return this.auth.googleSignIn(body, requestMeta(req));
  }

  @Public()
  @Post("register")
  register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.register(body, requestMeta(req));
  }

  @Public()
  @Get("username-available")
  usernameAvailable(@Query("username") username: string, @Req() req: Request) {
    this.auth.assertPasswordAuth();
    return this.auth.usernameAvailable(username ?? "", requestMeta(req));
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  login(
    @Body(new ZodPipe(loginSchema)) body: { email: string; password: string },
    @Req() req: Request,
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.login(body.email, body.password, requestMeta(req));
  }

  @Public()
  @HttpCode(200)
  @Post("admin/login")
  adminLogin(
    @Body(new ZodPipe(loginSchema)) body: { email: string; password: string },
    @Req() req: Request,
  ) {
    return this.auth.adminLogin(body.email, body.password, requestMeta(req));
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() body: { refreshToken?: string }, @Req() req: Request) {
    if (!body?.refreshToken)
      throw new AppError(400, "VALIDATION_ERROR", "Refresh token is required");
    return this.auth.refresh(body.refreshToken, requestMeta(req));
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  logout(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken)
      throw new AppError(400, "VALIDATION_ERROR", "Refresh token is required");
    return this.auth.logout(body.refreshToken);
  }

  @AllowDeactivated()
  @HttpCode(200)
  @Post("logout-all")
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAll(user.id);
  }

  @HttpCode(200)
  @Post("verify-email/request")
  requestVerification(@CurrentUser() user: AuthUser) {
    return this.auth.requestEmailVerification(user.id);
  }

  @Public()
  @HttpCode(200)
  @Post("verify-email")
  verifyEmail(
    @Body(new ZodPipe(verifyEmailSchema)) body: { email: string; code: string },
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.verifyEmail(body.email, body.code);
  }

  @Public()
  @HttpCode(200)
  @Post("password/forgot")
  forgot(
    @Body(new ZodPipe(requestEmailSchema)) body: { email: string },
    @Req() req: Request,
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.forgotPassword(body.email, requestMeta(req));
  }

  @Public()
  @HttpCode(200)
  @Post("password/reset")
  reset(
    @Body(new ZodPipe(resetPasswordSchema))
    body: { email: string; code: string; password: string },
    @Req() req: Request,
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.resetPassword(
      body.email,
      body.code,
      body.password,
      requestMeta(req),
    );
  }

  @Public()
  @HttpCode(200)
  @Post("reactivate")
  reactivate(
    @Body(new ZodPipe(reactivateSchema))
    body: { email: string; password: string },
    @Req() req: Request,
  ) {
    this.auth.assertPasswordAuth();
    return this.auth.reactivate(body.email, body.password, requestMeta(req));
  }
}
