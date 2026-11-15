import { Global, Module } from "@nestjs/common";
import { RateLimitService } from "../common/rate-limiter";
import { APP_CONFIG, loadConfig } from "./env";

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    RateLimitService,
  ],
  exports: [APP_CONFIG, RateLimitService],
})
export class AppConfigModule {}
