/**
 * Turns the student's synced academic data into what the AI service needs. Plain functions, no framework, so they are
 * easy to test. Contact details, the university id and the photo are left out on purpose.
 */

export type OverviewLike = {
  connected: boolean;
  connection?: {
    studentName: string | null;
    program: string | null;
    semester: number;
    section: string | null;
    mentor: { name?: string } | null;
  };
  attendance?: {
    courseCode: string;
    courseName: string;
    facultyName: string | null;
    attendedClasses: number;
    deliveredClasses: number;
    dutyLeave: number;
    percentage: number;
    minRequired: number;
    lastLectureAt: Date | string | null;
    history: { date: string; timing: string; status: string }[];
  }[];
  timetable?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    courseCode: string;
    courseName: string;
    room: string;
    facultyName: string | null;
    slotType: string;
  }[];
  marks?: {
    semester: number;
    courseCode: string;
    courseName: string;
    assessmentName: string;
    category: string;
    obtainedMarks: number;
    maxMarks: number;
    weightage: number | null;
    publishedAt: Date | string;
  }[];
  alerts?: { category: string; courseCode: string | null; title: string; body: string; publishedAt: Date | string }[];
  notices?: { kind: string; title: string; body?: string; date?: string }[];
};

export type AiContextOptions = { clientTime?: string; timezone?: string; now?: Date };

const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());

export function buildAiContext(overview: OverviewLike, options: AiContextOptions = {}) {
  const connection = overview.connection;
  return {
    now: options.clientTime ?? (options.now ?? new Date()).toISOString(),
    timezone: options.timezone ?? 'Asia/Kolkata',
    student: {
      name: connection?.studentName ?? null,
      program: connection?.program ?? null,
      semester: connection?.semester ?? null,
      section: connection?.section ?? null,
      mentor: connection?.mentor?.name ?? null,
    },
    attendance: (overview.attendance ?? []).map((course) => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      facultyName: course.facultyName,
      attendedClasses: course.attendedClasses,
      deliveredClasses: course.deliveredClasses,
      dutyLeave: course.dutyLeave,
      percentage: course.percentage,
      minRequired: course.minRequired,
      lastLectureAt: iso(course.lastLectureAt),
      history: course.history.slice(0, 10),
    })),
    timetable: (overview.timetable ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseCode: slot.courseCode,
      courseName: slot.courseName,
      room: slot.room,
      facultyName: slot.facultyName,
      slotType: slot.slotType,
    })),
    marks: (overview.marks ?? []).slice(0, 200).map((mark) => ({
      semester: mark.semester,
      courseCode: mark.courseCode,
      courseName: mark.courseName,
      assessmentName: mark.assessmentName,
      category: mark.category,
      obtainedMarks: mark.obtainedMarks,
      maxMarks: mark.maxMarks,
      weightage: mark.weightage,
      publishedAt: iso(mark.publishedAt) ?? '',
    })),
    alerts: (overview.alerts ?? []).slice(0, 10).map((alert) => ({
      category: alert.category,
      courseCode: alert.courseCode,
      title: alert.title,
      body: alert.body.slice(0, 400),
      publishedAt: iso(alert.publishedAt) ?? '',
    })),
    notices: (overview.notices ?? []).slice(0, 10).map((notice) => ({
      kind: notice.kind,
      title: notice.title,
      body: notice.body?.slice(0, 400) ?? null,
      date: notice.date ?? null,
    })),
  };
}
