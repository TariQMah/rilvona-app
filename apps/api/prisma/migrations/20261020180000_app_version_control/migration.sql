-- Version control for the mobile apps, edited from the admin panel.
-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "app_version_configs" (
    "platform" "AppPlatform" NOT NULL,
    "latestVersionCode" INTEGER NOT NULL DEFAULT 1,
    "latestVersionName" TEXT NOT NULL DEFAULT '1.0.0',
    "minVersionCode" INTEGER NOT NULL DEFAULT 1,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "releaseNotes" TEXT NOT NULL DEFAULT '',
    "storeUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_version_configs_pkey" PRIMARY KEY ("platform")
);

-- Starting rows: this release (versionCode 5) is the latest and nobody is forced to update.
INSERT INTO "app_version_configs" ("platform", "latestVersionCode", "latestVersionName", "minVersionCode", "forceUpdate", "releaseNotes", "storeUrl", "updatedAt")
VALUES
  ('ANDROID', 5, '1.0.0', 1, false, '', 'https://play.google.com/store/apps/details?id=com.ainor.hiihive', CURRENT_TIMESTAMP),
  ('IOS', 1, '1.0.0', 1, false, '', '', CURRENT_TIMESTAMP);
