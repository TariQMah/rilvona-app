import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    OTP_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),
    DEV_EXPOSE_OTP: z.enum(["true", "false"]).default("false"),
    THROTTLE_DISABLED: z.enum(["true", "false"]).default("false"),
    ENABLE_QUEUE: z.enum(["true", "false"]).default("false"),
    ALLOW_DEMO_LMS: z.enum(["true", "false"]).default("false"),
    GOOGLE_CLIENT_IDS: z.string().default(""),
    PASSWORD_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
    CORS_ORIGINS: z.string().default(""),
    AI_SERVICE_URL: z.string().default("http://127.0.0.1:4310"),
    AI_SERVICE_KEY: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
    PUBLIC_WEB_ORIGIN: z.string().default("https://hiihive.app"),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_UPLOAD_DIR: z.string().default("var/uploads"),
    STORAGE_ENDPOINT: z.preprocess(emptyToUndefined, z.string().optional()),
    STORAGE_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
    STORAGE_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    STORAGE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    STORAGE_REGION: z.string().default("us-east-1"),
    STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
    STORAGE_PUBLIC_BASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    if (value.STORAGE_DRIVER !== "s3") {
      ctx.addIssue({
        code: "custom",
        message: "Production requires STORAGE_DRIVER=s3",
        path: ["STORAGE_DRIVER"],
      });
    }
    if (value.DEV_EXPOSE_OTP === "true") {
      ctx.addIssue({
        code: "custom",
        message: "Production cannot expose OTP codes",
        path: ["DEV_EXPOSE_OTP"],
      });
    }
    if (value.THROTTLE_DISABLED === "true") {
      ctx.addIssue({
        code: "custom",
        message: "Production cannot disable rate limits",
        path: ["THROTTLE_DISABLED"],
      });
    }
    for (const key of [
      "STORAGE_ENDPOINT",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY",
      "STORAGE_SECRET_KEY",
    ] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: "custom",
          message: `${key} is required in production`,
          path: [key],
        });
      }
    }
  });

export type AppConfig = {
  nodeEnv: "development" | "test" | "staging" | "production";
  port: number;
  databaseUrl: string;
  redisUrl?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  otpSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;
  exposeOtp: boolean;
  throttleDisabled: boolean;
  enableQueue: boolean;
  allowDemoLms: boolean;
  googleClientIds: string[];
  passwordAuthEnabled: boolean;
  corsOrigins: string[];
  aiServiceUrl: string;
  aiServiceKey?: string;
  publicWebOrigin: string;
  storageDriver: "local" | "s3";
  localUploadDir: string;
  storageEndpoint?: string;
  storageBucket?: string;
  storageAccessKey?: string;
  storageSecretKey?: string;
  storageRegion: string;
  storageForcePathStyle: boolean;
  storagePublicBaseUrl?: string;
};

export const APP_CONFIG = Symbol("APP_CONFIG");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.parse(env);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
    otpSecret: parsed.OTP_SECRET,
    jwtAccessTtlSeconds: parsed.JWT_ACCESS_TTL_SECONDS,
    jwtRefreshTtlSeconds: parsed.JWT_REFRESH_TTL_SECONDS,
    exposeOtp:
      parsed.DEV_EXPOSE_OTP === "true" && parsed.NODE_ENV !== "production",
    throttleDisabled: parsed.THROTTLE_DISABLED === "true",
    enableQueue: parsed.ENABLE_QUEUE === "true",
    allowDemoLms:
      parsed.ALLOW_DEMO_LMS === "true" && parsed.NODE_ENV !== "production",
    googleClientIds: parsed.GOOGLE_CLIENT_IDS.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    passwordAuthEnabled: parsed.PASSWORD_AUTH_ENABLED === "true",
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    aiServiceUrl: parsed.AI_SERVICE_URL.replace(/\/$/, ""),
    aiServiceKey: parsed.AI_SERVICE_KEY,
    publicWebOrigin: parsed.PUBLIC_WEB_ORIGIN.replace(/\/$/, ""),
    storageDriver: parsed.STORAGE_DRIVER,
    localUploadDir: parsed.LOCAL_UPLOAD_DIR,
    storageEndpoint: parsed.STORAGE_ENDPOINT,
    storageBucket: parsed.STORAGE_BUCKET,
    storageAccessKey: parsed.STORAGE_ACCESS_KEY,
    storageSecretKey: parsed.STORAGE_SECRET_KEY,
    storageRegion: parsed.STORAGE_REGION,
    storageForcePathStyle: parsed.STORAGE_FORCE_PATH_STYLE === "true",
    storagePublicBaseUrl: parsed.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, ""),
  };
}
