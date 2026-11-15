import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ImportLmsInput, SimulateLmsEventInput } from '@hiihive/contracts';
import { Prisma } from '@prisma/client';
import { AppError, notFound } from '../common/errors';
import { AppConfig, APP_CONFIG } from '../config/env';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChandigarhUniversityAdapter,
  computeAttendanceGuidance,
  computePercentage,
} from './chandigarh-university.adapter';
import { parseCuimsTables, splitCourse } from './cuims-parser';

type AlertCategory = 'ATTENDANCE' | 'MARKS' | 'TIMETABLE' | 'ASSIGNMENT' | 'ANNOUNCEMENT' | 'EXAM';

type Mentor = { name?: string; designation?: string; department?: string; phone?: string; email?: string; lines: string[] };
type PortalNotice = { kind: 'MESSAGE' | 'ANNOUNCEMENT' | 'NOTIFICATION'; title: string; body?: string; date?: string };

/** Invented lecture history for demo data only: one entry per delivered class, absences spread evenly. */
function demoHistory(
  connectionId: string,
  attendance: { courseCode: string; attendedClasses: number; deliveredClasses: number }[],
) {
  const rows: { connectionId: string; courseCode: string; occurredOn: Date; timing: string; status: string }[] = [];
  attendance.forEach((course, index) => {
    const absences = Math.max(0, course.deliveredClasses - course.attendedClasses);
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - 1 - (index % 3));
    for (let n = 0; n < course.deliveredClasses; n += 1) {
      while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() - 1);
      const absentEvery = absences > 0 ? Math.floor(course.deliveredClasses / absences) : 0;
      const absent = absences > 0 && absentEvery > 0 && n % absentEvery === absentEvery - 1 && n / absentEvery < absences;
      rows.push({
        connectionId,
        courseCode: course.courseCode,
        occurredOn: new Date(day),
        timing: '09:30 - 10:20',
        status: absent ? 'ABSENT' : 'PRESENT',
      });
      day.setUTCDate(day.getUTCDate() - 1 - (n % 2));
    }
  });
  return rows;
}

const short = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 12);

@Injectable()
export class AcademicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cuAdapter: ChandigarhUniversityAdapter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async overview(userId: string) {
    const connection = await this.prisma.lmsConnection.findUnique({
      where: { userId },
      include: {
        college: { select: { id: true, name: true, slug: true } },
        attendance: { orderBy: { courseCode: 'asc' } },
        timetable: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        marks: { orderBy: [{ courseCode: 'asc' }, { publishedAt: 'desc' }] },
        alerts: { orderBy: { publishedAt: 'desc' }, take: 25 },
        attendanceLog: { orderBy: [{ occurredOn: 'desc' }, { timing: 'desc' }] },
      },
    });

    if (!connection) {
      return {
        connected: false as const,
        demoAvailable: this.config.allowDemoLms,
        supportedColleges: [
          {
            provider: 'CHANDIGARH_UNIVERSITY' as const,
            name: 'Chandigarh University',
            loginUrl: 'https://students.cuchd.in',
            portals: ['CUIMS (students.cuchd.in)', 'CU LMS (lms.cuchd.in)'],
          },
        ],
      };
    }

    const historyByCourse = new Map<string, { date: string; timing: string; status: string }[]>();
    for (const entry of connection.attendanceLog) {
      const list = historyByCourse.get(entry.courseCode) ?? [];
      if (list.length < 400) {
        list.push({ date: entry.occurredOn.toISOString().slice(0, 10), timing: entry.timing, status: entry.status });
      }
      historyByCourse.set(entry.courseCode, list);
    }

    const attendance = connection.attendance.map((item) => ({
      id: item.id,
      courseCode: item.courseCode,
      courseName: item.courseName,
      facultyName: item.facultyName,
      attendedClasses: item.attendedClasses,
      deliveredClasses: item.deliveredClasses,
      dutyLeave: item.dutyLeave,
      percentage: item.percentage,
      minRequired: item.minRequired,
      lastLectureAt: item.lastLectureAt,
      lastStatus: item.lastStatus,
      guidance: computeAttendanceGuidance(item.attendedClasses, item.deliveredClasses, item.dutyLeave, item.minRequired),
      history: historyByCourse.get(item.courseCode) ?? [],
    }));

    const totalAttended = attendance.reduce(
      (sum, row) => sum + Math.min(row.deliveredClasses, row.attendedClasses + row.dutyLeave),
      0,
    );
    const totalDelivered = attendance.reduce((sum, row) => sum + row.deliveredClasses, 0);
    const safeCourses = attendance.filter((row) => row.percentage >= row.minRequired).length;

    const scored = connection.marks.filter((m) => m.maxMarks > 0);
    const totalObtained = scored.reduce((sum, m) => sum + m.obtainedMarks, 0);
    const totalMax = scored.reduce((sum, m) => sum + m.maxMarks, 0);

    const jsDay = new Date().getDay();
    const activeDay = jsDay === 0 ? 1 : jsDay;

    return {
      connected: true as const,
      demoAvailable: this.config.allowDemoLms,
      connection: {
        id: connection.id,
        provider: connection.provider,
        studentUid: connection.studentUid,
        studentName: connection.studentName,
        program: connection.program,
        semester: connection.semester,
        section: connection.section,
        sectionGroup: connection.sectionGroup,
        photo: connection.photo,
        mentor: (connection.mentor as Mentor | null) ?? null,
        syncStatus: connection.syncStatus,
        lastSyncedAt: connection.lastSyncedAt,
        isDemo: connection.isDemo,
        dataSource: connection.dataSource,
        college: connection.college,
      },
      summary: {
        overallAttendance: attendance.length ? computePercentage(totalAttended, totalDelivered, 0) : null,
        totalAttended,
        totalDelivered,
        safeCourses,
        shortageCourses: attendance.length - safeCourses,
        averageScorePct: totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : null,
        todayClasses: connection.timetable.filter((slot) => slot.dayOfWeek === activeDay).length,
        activeDay,
        alertCount: connection.alerts.length,
      },
      attendance,
      timetable: connection.timetable,
      marks: connection.marks,
      alerts: connection.alerts,
      notices: (connection.notices as PortalNotice[] | null) ?? [],
    };
  }

  /**
   * Imports tables read on the student's device from their own logged-in CUIMS
   * session. No credentials are accepted or stored. Notifications are created
   * only for real differences against what was imported before.
   */
  async importFromPortal(userId: string, input: ImportLmsInput) {
    const parsed = parseCuimsTables(input.tables);
    const recognized = {
      attendance: parsed.attendance.length,
      timetable: parsed.timetable.length,
      marks: parsed.marks.length,
    };
    const nothing = recognized.attendance + recognized.timetable + recognized.marks === 0;
    if (nothing) {
      return {
        imported: false,
        recognized,
        unrecognized: parsed.unrecognized,
        notificationsCreated: 0,
        overview: await this.overview(userId),
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw notFound('User not found');
    const cuCollege = await this.prisma.college.findUnique({ where: { slug: 'chandigarh-university' } });

    let connection = await this.prisma.lmsConnection.findUnique({ where: { userId } });
    if (connection?.isDemo) {
      await this.prisma.lmsConnection.delete({ where: { id: connection.id } });
      connection = null;
    }
    const firstImport = !connection;
    const now = new Date();
    connection = await this.prisma.lmsConnection.upsert({
      where: { userId },
      update: {
        studentUid: input.studentUid,
        studentName: input.studentName ?? undefined,
        lastSyncedAt: now,
        syncStatus: 'CONNECTED',
        lastError: null,
      },
      create: {
        userId,
        provider: input.provider,
        collegeId: cuCollege?.id ?? user.collegeId,
        studentUid: input.studentUid,
        studentName: input.studentName ?? user.profile?.displayName ?? null,
        program: this.cuAdapter.inferProgram(input.studentUid),
        semester: input.profile?.semester ?? this.cuAdapter.inferSemester(input.studentUid),
        isDemo: false,
        dataSource: 'CUIMS_IMPORT',
        lastSyncedAt: now,
      },
    });
    if (cuCollege && !user.collegeId) {
      await this.prisma.user.update({ where: { id: userId }, data: { collegeId: cuCollege.id } });
    }

    if (input.profile) {
      const p = input.profile;
      await this.prisma.lmsConnection.update({
        where: { id: connection.id },
        data: {
          studentName: p.name ?? undefined,
          semester: p.semester ?? undefined,
          section: p.section ?? undefined,
          sectionGroup: p.group ?? undefined,
          photo: p.photo ?? undefined,
          // No mentor in this refresh means the portal has none to show, so clear any old (or placeholder) card.
          mentor: p.mentor ? (p.mentor as Prisma.InputJsonValue) : Prisma.JsonNull,
          // An empty list is a real answer ("nothing new"), so it replaces the old one.
          notices: p.notices as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const changes: { category: AlertCategory; ref: string; courseCode?: string; title: string; body: string }[] = [];

    if (parsed.attendance.length > 0) {
      const existing = new Map(
        (await this.prisma.attendanceRecord.findMany({ where: { connectionId: connection.id } })).map((r) => [r.courseCode, r]),
      );
      for (const item of parsed.attendance) {
        // The portal's "attended" figure is authoritative; we do not add duty leave on top of it.
        const pct = computePercentage(item.attendedClasses, item.deliveredClasses, 0);
        const before = existing.get(item.courseCode);
        const changed = !before || before.deliveredClasses !== item.deliveredClasses || before.attendedClasses !== item.attendedClasses;
        await this.prisma.attendanceRecord.upsert({
          where: { connectionId_courseCode: { connectionId: connection.id, courseCode: item.courseCode } },
          update: {
            courseName: item.courseName,
            facultyName: item.facultyName,
            attendedClasses: item.attendedClasses,
            deliveredClasses: item.deliveredClasses,
            dutyLeave: 0,
            percentage: pct,
            lastLectureAt: changed ? now : before?.lastLectureAt,
            lastStatus: before && changed ? (item.attendedClasses > before.attendedClasses ? 'PRESENT' : 'ABSENT') : before?.lastStatus,
          },
          create: {
            connectionId: connection.id,
            courseCode: item.courseCode,
            courseName: item.courseName,
            facultyName: item.facultyName,
            attendedClasses: item.attendedClasses,
            deliveredClasses: item.deliveredClasses,
            dutyLeave: 0,
            percentage: pct,
          },
        });
        if (before && changed) {
          const guidance = computeAttendanceGuidance(item.attendedClasses, item.deliveredClasses, 0, before.minRequired);
          changes.push({
            category: 'ATTENDANCE',
            ref: `att:${item.courseCode}:${item.attendedClasses}/${item.deliveredClasses}`,
            courseCode: item.courseCode,
            title: `Attendance updated · ${item.courseName}`,
            body: `Now ${item.attendedClasses}/${item.deliveredClasses} (${pct}%). ${guidance.label}.`,
          });
        }
      }
    }

    if (input.attendanceLog && input.attendanceLog.length > 0) {
      const known = new Set(
        (await this.prisma.attendanceRecord.findMany({ where: { connectionId: connection.id }, select: { courseCode: true } })).map(
          (r) => r.courseCode,
        ),
      );
      const byCourse = new Map<string, NonNullable<ImportLmsInput['attendanceLog']>>();
      for (const entry of input.attendanceLog) {
        const code = splitCourse(entry.title, entry.code).courseCode;
        if (!known.has(code)) continue;
        byCourse.set(code, [...(byCourse.get(code) ?? []), entry]);
      }
      for (const [code, entries] of byCourse) {
        await this.prisma.$transaction([
          this.prisma.attendanceEntry.deleteMany({ where: { connectionId: connection.id, courseCode: code } }),
          this.prisma.attendanceEntry.createMany({
            data: entries.map((e) => ({
              connectionId: connection!.id,
              courseCode: code,
              occurredOn: new Date(`${e.date}T00:00:00.000Z`),
              timing: e.timing,
              status: e.status,
            })),
            skipDuplicates: true,
          }),
        ]);
      }
    }

    if (parsed.marks.length > 0) {
      const existing = new Map(
        (await this.prisma.courseMark.findMany({ where: { connectionId: connection.id } })).map((m) => [`${m.courseCode}|${m.assessmentName}`, m]),
      );
      for (const mark of parsed.marks) {
        const before = existing.get(`${mark.courseCode}|${mark.assessmentName}`);
        await this.prisma.courseMark.upsert({
          where: {
            connectionId_courseCode_assessmentName: {
              connectionId: connection.id,
              courseCode: mark.courseCode,
              assessmentName: mark.assessmentName,
            },
          },
          update: { obtainedMarks: mark.obtainedMarks, maxMarks: mark.maxMarks, courseName: mark.courseName, category: mark.category },
          create: { connectionId: connection.id, semester: connection.semester, ...mark },
        });
        if (before && (before.obtainedMarks !== mark.obtainedMarks || before.maxMarks !== mark.maxMarks)) {
          changes.push({
            category: 'MARKS',
            ref: `mark:${mark.courseCode}:${mark.assessmentName}:${mark.obtainedMarks}/${mark.maxMarks}`,
            courseCode: mark.courseCode,
            title: `Marks updated · ${mark.courseName}`,
            body: `${mark.assessmentName}: ${mark.obtainedMarks}${mark.maxMarks ? ` / ${mark.maxMarks}` : ''}.`,
          });
        } else if (!before && !firstImport) {
          changes.push({
            category: 'MARKS',
            ref: `mark:${mark.courseCode}:${mark.assessmentName}:${mark.obtainedMarks}/${mark.maxMarks}`,
            courseCode: mark.courseCode,
            title: `New marks · ${mark.courseName}`,
            body: `${mark.assessmentName}: ${mark.obtainedMarks}${mark.maxMarks ? ` / ${mark.maxMarks}` : ''}.`,
          });
        }
      }
    }

    if (parsed.timetable.length > 0) {
      const oldSlots = await this.prisma.timetableSlot.findMany({ where: { connectionId: connection.id } });
      const sig = (slots: { dayOfWeek: number; startTime: string; endTime: string; courseCode: string; room: string }[]) =>
        short(
          slots
            .map((s) => `${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.courseCode}|${s.room}`)
            .sort()
            .join('\n'),
        );
      const oldSig = sig(oldSlots);
      const newSig = sig(parsed.timetable);
      if (oldSig !== newSig) {
        await this.prisma.$transaction([
          this.prisma.timetableSlot.deleteMany({ where: { connectionId: connection.id } }),
          this.prisma.timetableSlot.createMany({
            data: parsed.timetable.map((slot) => ({ connectionId: connection!.id, ...slot })),
          }),
        ]);
        if (oldSlots.length > 0) {
          changes.push({
            category: 'TIMETABLE',
            ref: `tt:${newSig}`,
            title: 'Timetable changed',
            body: 'Your CUIMS timetable has been updated. Check the Timetable tab for the new schedule.',
          });
        }
      }
    }

    let created = 0;
    for (const change of changes) {
      const exists = await this.prisma.lmsPortalAlert.findUnique({
        where: { connectionId_externalRef: { connectionId: connection.id, externalRef: change.ref } },
      });
      if (exists) continue;
      const alert = await this.prisma.lmsPortalAlert.create({
        data: {
          connectionId: connection.id,
          externalRef: change.ref,
          portalSource: 'CUIMS',
          category: change.category,
          courseCode: change.courseCode,
          title: change.title,
          body: change.body,
          actionUrl: 'https://students.cuchd.in',
          publishedAt: now,
        },
      });
      await this.notifications.notify({
        userId,
        type: 'LMS',
        preference: 'lms',
        title: change.title,
        body: change.body,
        data: { alertId: alert.id, portalSource: 'CUIMS', category: change.category, courseCode: change.courseCode ?? null },
      });
      created += 1;
    }

    if (firstImport) {
      await this.notifications.notify({
        userId,
        type: 'LMS',
        preference: 'lms',
        title: 'Chandigarh University portal linked',
        body: `Imported ${recognized.attendance} attendance rows, ${recognized.timetable} timetable slots and ${recognized.marks} marks from CUIMS.`,
        data: { category: 'ANNOUNCEMENT', portalSource: 'CUIMS' },
      });
      created += 1;
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'LMS_IMPORTED',
        targetType: 'LMS_CONNECTION',
        targetId: connection.id,
        metadata: { ...recognized, changes: changes.length },
      },
    });

    return {
      imported: true,
      recognized,
      unrecognized: parsed.unrecognized,
      notificationsCreated: created,
      overview: await this.overview(userId),
    };
  }

  /** Loads clearly labelled sample data. Disabled unless ALLOW_DEMO_LMS=true (never in production). */
  async loadDemo(userId: string) {
    this.assertDemoAllowed();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw notFound('User not found');
    const cuCollege = await this.prisma.college.findUnique({ where: { slug: 'chandigarh-university' } });
    await this.prisma.lmsConnection.deleteMany({ where: { userId } });
    const snapshot = this.cuAdapter.buildInitialSnapshot({
      studentUid: 'DEMO00000',
      studentName: user.profile?.displayName ?? 'Demo student',
      semester: 5,
      section: 'DEMO-SECTION',
    });
    const connection = await this.prisma.lmsConnection.create({
      data: {
        userId,
        provider: 'CHANDIGARH_UNIVERSITY',
        collegeId: cuCollege?.id ?? user.collegeId,
        studentUid: 'DEMO00000',
        studentName: snapshot.studentName,
        program: 'Sample program (demo data)',
        semester: snapshot.semester,
        section: snapshot.section,
        isDemo: true,
        dataSource: 'DEMO',
        lastSyncedAt: new Date(),
      },
    });
    await this.prisma.$transaction([
      this.prisma.attendanceRecord.createMany({
        data: snapshot.attendance.map((item) => ({
          connectionId: connection.id,
          courseCode: item.courseCode,
          courseName: item.courseName,
          facultyName: item.facultyName,
          attendedClasses: item.attendedClasses,
          deliveredClasses: item.deliveredClasses,
          dutyLeave: item.dutyLeave,
          percentage: computePercentage(item.attendedClasses, item.deliveredClasses, item.dutyLeave),
          minRequired: item.minRequired,
          lastLectureAt: item.lastLectureAt,
          lastStatus: item.lastStatus,
        })),
      }),
      this.prisma.timetableSlot.createMany({ data: snapshot.timetable.map((slot) => ({ connectionId: connection.id, ...slot })) }),
      this.prisma.courseMark.createMany({ data: snapshot.marks.map((mark) => ({ connectionId: connection.id, ...mark })) }),
      this.prisma.attendanceEntry.createMany({ data: demoHistory(connection.id, snapshot.attendance) }),
    ]);
    return this.overview(userId);
  }

  async simulateRealtimeEvent(userId: string, input: SimulateLmsEventInput) {
    this.assertDemoAllowed();
    const connection = await this.prisma.lmsConnection.findUnique({
      where: { userId },
      include: { attendance: { orderBy: { courseCode: 'asc' } }, timetable: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }, marks: true },
    });
    if (!connection) throw notFound('Load demo data first');
    if (!connection.isDemo) throw new AppError(403, 'DEMO_ONLY', 'The simulator only works on demo data, never on your real portal data');

    const now = new Date();
    const target =
      connection.attendance.find((c) => c.courseCode === input.courseCode) ?? connection.attendance[0];
    let title = '';
    let body = '';
    let category: AlertCategory = 'ANNOUNCEMENT';
    let courseCode: string | undefined = target?.courseCode;

    if (input.kind === 'ATTENDANCE_MARKED' && target) {
      const attended = target.attendedClasses + 1;
      const delivered = target.deliveredClasses + 1;
      const pct = computePercentage(attended, delivered, target.dutyLeave);
      await this.prisma.attendanceRecord.update({
        where: { id: target.id },
        data: { attendedClasses: attended, deliveredClasses: delivered, percentage: pct, lastLectureAt: now, lastStatus: 'PRESENT' },
      });
      category = 'ATTENDANCE';
      title = `[DEMO] Attendance marked · ${target.courseCode}`;
      body = `Marked present in ${target.courseName}: ${attended}/${delivered} (${pct}%).`;
    } else if (input.kind === 'MARKS_UPLOADED' && target) {
      const assessmentName = `Demo Quiz ${connection.marks.length + 1}`;
      await this.prisma.courseMark.create({
        data: {
          connectionId: connection.id,
          semester: connection.semester,
          courseCode: target.courseCode,
          courseName: target.courseName,
          assessmentName,
          category: 'INTERNAL',
          obtainedMarks: 9,
          maxMarks: 10,
          weightage: 5,
          publishedAt: now,
        },
      });
      category = 'MARKS';
      title = `[DEMO] Marks uploaded · ${target.courseCode}`;
      body = `${assessmentName}: 9 / 10 in ${target.courseName}.`;
    } else if (input.kind === 'TIMETABLE_CHANGED' && connection.timetable[0]) {
      const slot = connection.timetable[0];
      const room = slot.room === 'Demo Room 1' ? 'Demo Room 2' : 'Demo Room 1';
      await this.prisma.timetableSlot.update({ where: { id: slot.id }, data: { room } });
      category = 'TIMETABLE';
      courseCode = slot.courseCode;
      title = `[DEMO] Timetable update · ${slot.courseCode}`;
      body = `${slot.courseName} (${slot.startTime}–${slot.endTime}) moved to ${room}.`;
    } else if (input.kind === 'LMS_ASSIGNMENT' && target) {
      category = 'ASSIGNMENT';
      title = `[DEMO] New assignment · ${target.courseCode}`;
      body = `Sample assignment posted for ${target.courseName}.`;
    } else {
      category = 'EXAM';
      courseCode = undefined;
      title = '[DEMO] Exam notice';
      body = 'Sample examination notice.';
    }

    const alert = await this.prisma.lmsPortalAlert.create({
      data: {
        connectionId: connection.id,
        externalRef: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        portalSource: input.kind === 'LMS_ASSIGNMENT' ? 'CU_LMS' : 'CUIMS',
        category,
        courseCode,
        title,
        body,
        publishedAt: now,
      },
    });
    const notification = await this.notifications.notify({
      userId,
      type: 'LMS',
      preference: 'lms',
      title,
      body,
      data: { alertId: alert.id, category, courseCode: courseCode ?? null, demo: true },
    });
    return { triggered: true, alert, notificationId: notification?.id ?? null, overview: await this.overview(userId) };
  }

  async disconnect(userId: string) {
    const existing = await this.prisma.lmsConnection.findUnique({ where: { userId } });
    if (!existing) return { disconnected: true };
    await this.prisma.$transaction([
      this.prisma.lmsConnection.delete({ where: { id: existing.id } }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'LMS_DISCONNECTED',
          targetType: 'LMS_CONNECTION',
          targetId: existing.id,
          metadata: { provider: existing.provider, studentUid: existing.studentUid },
        },
      }),
    ]);
    return { disconnected: true };
  }

  private assertDemoAllowed() {
    if (!this.config.allowDemoLms) {
      throw new AppError(403, 'DEMO_DISABLED', 'Demo data is disabled on this server');
    }
  }
}
