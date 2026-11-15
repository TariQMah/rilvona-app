-- The CUIMS (LMS) tables and the LMS notification setting were in the schema but never in a migration.
-- CreateEnum
CREATE TYPE "LmsProvider" AS ENUM ('CHANDIGARH_UNIVERSITY');

-- CreateEnum
CREATE TYPE "LmsSyncStatus" AS ENUM ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "LmsAlertCategory" AS ENUM ('ATTENDANCE', 'TIMETABLE', 'MARKS', 'ASSIGNMENT', 'ANNOUNCEMENT', 'EXAM');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LMS';

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "lms" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "lms_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collegeId" TEXT,
    "provider" "LmsProvider" NOT NULL DEFAULT 'CHANDIGARH_UNIVERSITY',
    "studentUid" TEXT NOT NULL,
    "studentName" TEXT,
    "program" TEXT,
    "semester" INTEGER NOT NULL DEFAULT 5,
    "section" TEXT,
    "sectionGroup" TEXT,
    "photo" TEXT,
    "mentor" JSONB,
    "notices" JSONB,
    "syncStatus" "LmsSyncStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "dataSource" TEXT NOT NULL DEFAULT 'CUIMS_IMPORT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lms_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "facultyName" TEXT,
    "attendedClasses" INTEGER NOT NULL,
    "deliveredClasses" INTEGER NOT NULL,
    "dutyLeave" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL,
    "minRequired" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "lastLectureAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_entries" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "timing" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,

    CONSTRAINT "attendance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "facultyName" TEXT,
    "slotType" TEXT NOT NULL DEFAULT 'LECTURE',
    "section" TEXT,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_marks" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL DEFAULT 5,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "assessmentName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'THEORY',
    "obtainedMarks" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "weightage" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lms_portal_alerts" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "portalSource" TEXT NOT NULL DEFAULT 'CUIMS',
    "category" "LmsAlertCategory" NOT NULL,
    "courseCode" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_portal_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lms_connections_userId_key" ON "lms_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_connectionId_courseCode_key" ON "attendance_records"("connectionId", "courseCode");

-- CreateIndex
CREATE INDEX "attendance_entries_connectionId_courseCode_occurredOn_idx" ON "attendance_entries"("connectionId", "courseCode", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_entries_connectionId_courseCode_occurredOn_timin_key" ON "attendance_entries"("connectionId", "courseCode", "occurredOn", "timing");

-- CreateIndex
CREATE INDEX "timetable_slots_connectionId_dayOfWeek_idx" ON "timetable_slots"("connectionId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "course_marks_connectionId_courseCode_assessmentName_key" ON "course_marks"("connectionId", "courseCode", "assessmentName");

-- CreateIndex
CREATE INDEX "lms_portal_alerts_connectionId_publishedAt_idx" ON "lms_portal_alerts"("connectionId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lms_portal_alerts_connectionId_externalRef_key" ON "lms_portal_alerts"("connectionId", "externalRef");

-- AddForeignKey
ALTER TABLE "lms_connections" ADD CONSTRAINT "lms_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lms_connections" ADD CONSTRAINT "lms_connections_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "lms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_entries" ADD CONSTRAINT "attendance_entries_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "lms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "lms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_marks" ADD CONSTRAINT "course_marks_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "lms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lms_portal_alerts" ADD CONSTRAINT "lms_portal_alerts_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "lms_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

