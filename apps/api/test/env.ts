import os from "os";

export function applyTestEnv() {
  process.env.NODE_ENV = "test";
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `postgresql://${os.userInfo().username}@localhost:5432/hiihive_test?schema=public`;
  }
  if (!process.env.DATABASE_URL.includes("hiihive_test")) {
    throw new Error(
      "Refusing to run tests against a database whose name does not include hiihive_test",
    );
  }
  process.env.JWT_ACCESS_SECRET ||= "test-access-secret-test-access-secret";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-test-refresh-secret";
  process.env.OTP_SECRET ||= "test-otp-secret-test-otp-secret-ok";
  process.env.DEV_EXPOSE_OTP ||= "true";
  process.env.THROTTLE_DISABLED ||= "true";
  process.env.ENABLE_QUEUE ||= "false";
  process.env.STORAGE_DRIVER ||= "local";
  process.env.PASSWORD_AUTH_ENABLED ||= "true";
  process.env.GOOGLE_CLIENT_IDS ||=
    "test-web-client.apps.googleusercontent.com";
  delete process.env.REDIS_URL;
}

applyTestEnv();
