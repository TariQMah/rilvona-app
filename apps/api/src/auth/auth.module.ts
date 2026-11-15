import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AccountStatusGuard, JwtAuthGuard } from "./guards";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, AccountStatusGuard],
  exports: [AuthService, JwtAuthGuard, AccountStatusGuard],
})
export class AuthModule {}
