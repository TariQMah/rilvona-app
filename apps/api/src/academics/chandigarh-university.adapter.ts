import { LmsAlertCategory } from '@prisma/client';

export type CuAttendanceSnapshot = {
  courseCode: string;
  courseName: string;
  facultyName: string;
  attendedClasses: number;
  deliveredClasses: number;
  dutyLeave: number;
  minRequired: number;
  lastLectureAt: Date;
  lastStatus: 'PRESENT' | 'ABSENT' | 'DUTY_LEAVE';
};

export type CuTimetableSnapshot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  room: string;
  facultyName: string;
  slotType: 'LECTURE' | 'LAB' | 'TUTORIAL';
  section: string;
};

export type CuMarkSnapshot = {
  semester: number;
  courseCode: string;
  courseName: string;
  assessmentName: string;
  category: 'THEORY' | 'PRACTICAL' | 'INTERNAL';
  obtainedMarks: number;
  maxMarks: number;
  weightage: number;
  publishedAt: Date;
};

export type CuAlertSnapshot = {
  externalRef: string;
  portalSource: 'CUIMS' | 'CU_LMS';
  category: LmsAlertCategory;
  courseCode?: string;
  title: string;
  body: string;
  actionUrl?: string;
  publishedAt: Date;
};

export type CuStudentSnapshot = {
  studentUid: string;
  studentName: string;
  program: string;
  semester: number;
  section: string;
  attendance: CuAttendanceSnapshot[];
  timetable: CuTimetableSnapshot[];
  marks: CuMarkSnapshot[];
  alerts: CuAlertSnapshot[];
};

const CU_COURSES = [
  {
    courseCode: '23CSH-301',
    courseName: 'Design & Analysis of Algorithms',
    facultyName: 'Dr. Harpreet Kaur (E11482)',
    room: 'Block B3 - 405',
    labRoom: 'Block B3 - Lab 204',
  },
  {
    courseCode: '23CST-302',
    courseName: 'Operating Systems',
    facultyName: 'Prof. Vikramjit Singh (E10941)',
    room: 'Block B1 - 312',
    labRoom: 'Block B1 - Lab 108',
  },
  {
    courseCode: '23CSH-304',
    courseName: 'Computer Networks',
    facultyName: 'Dr. Meenakshi Sharma (E12810)',
    room: 'Block B3 - 409',
    labRoom: 'Block B3 - Lab 210',
  },
  {
    courseCode: '23CSH-305',
    courseName: 'Full Stack Web & Mobile Dev',
    facultyName: 'Er. Amanpreet Sidhu (E14205)',
    room: 'Block D5 (AIT) - 201',
    labRoom: 'Block D5 (AIT) - Lab 102',
  },
  {
    courseCode: '23TDP-301',
    courseName: 'Aptitude & Campus Placement Prep (TPP)',
    facultyName: 'Prof. Rohit Verma (E13522)',
    room: 'Block C2 - Seminar Hall 2',
    labRoom: 'Block C2 - 104',
  },
  {
    courseCode: '23CSR-308',
    courseName: 'Competitive Coding & Problem Solving Lab',
    facultyName: 'Er. Simranjeet Gill (E15019)',
    room: 'Block B3 - Lab 302',
    labRoom: 'Block B3 - Lab 302',
  },
] as const;

export function computePercentage(attended: number, delivered: number, dutyLeave = 0): number {
  if (delivered <= 0) return 100;
  const effective = Math.min(delivered, attended + dutyLeave);
  return Math.round((effective / delivered) * 1000) / 10;
}

export function computeAttendanceGuidance(attended: number, delivered: number, dutyLeave = 0, minRequired = 75) {
  const effective = Math.min(delivered, attended + dutyLeave);
  const ratio = minRequired / 100;
  const currentPct = computePercentage(attended, delivered, dutyLeave);
  if (currentPct >= minRequired) {
    // How many future classes can be missed while staying >= 75%?
    // effective / (delivered + x) >= 0.75 => delivered + x <= effective / 0.75
    const canMiss = Math.max(0, Math.floor(effective / ratio - delivered));
    return {
      status: canMiss === 0 ? ('BORDERLINE' as const) : ('SAFE' as const),
      canMiss,
      needToAttend: 0,
      label:
        canMiss > 0
          ? `Safe · Can miss ${canMiss} lecture${canMiss === 1 ? '' : 's'} and stay ≥ ${minRequired}%`
          : `On the edge · Attend next lecture to stay ≥ ${minRequired}%`,
    };
  }
  // How many consecutive classes must be attended to reach 75%?
  // (effective + y) / (delivered + y) >= 0.75 => y >= (0.75 * delivered - effective) / 0.25
  const needToAttend = Math.max(1, Math.ceil((ratio * delivered - effective) / (1 - ratio)));
  return {
    status: 'SHORTAGE' as const,
    canMiss: 0,
    needToAttend,
    label: `Shortage (<${minRequired}%) · Attend next ${needToAttend} lecture${needToAttend === 1 ? '' : 's'} to recover`,
  };
}

/**
 * DEMO ONLY. `buildInitialSnapshot` returns invented sample data and never
 * contacts CUIMS. Real data arrives through the import endpoint. It is only
 * reachable when ALLOW_DEMO_LMS=true outside production.
 */
export class ChandigarhUniversityAdapter {
  readonly courses = CU_COURSES;

  /**
   * Fallback when the portal did not report a semester: the admission year is the first two digits of the UID and
   * the academic year starts in July, so Oct 2026 for a "26..." UID is semester 1 and Jan 2027 is semester 2.
   */
  inferSemester(uid: string, now: Date = new Date()): number {
    const admission = Number(/^(\d{2})/.exec(uid)?.[1]);
    if (!Number.isFinite(admission)) return 1;
    const odd = now.getMonth() >= 6;
    const academicStart = odd ? now.getFullYear() : now.getFullYear() - 1;
    const semester = (academicStart - (2000 + admission)) * 2 + (odd ? 1 : 2);
    return Math.max(1, Math.min(12, semester));
  }

  inferProgram(uid: string): string {
    const branch = uid.replace(/^[0-9]{2}/, '').replace(/[0-9]+$/, '');
    switch (branch) {
      case 'BCS':
      case 'BCG':
      case 'BAI':
        return 'B.E. Computer Science & Engineering (APEX / UIE)';
      case 'MCA':
        return 'Master of Computer Applications (UIC)';
      case 'MBA':
        return 'Master of Business Administration (USB)';
      case 'BEC':
        return 'B.E. Electronics & Communication Engineering';
      default:
        return `Chandigarh University (${branch || 'Engineering'})`;
    }
  }

  buildInitialSnapshot(params: {
    studentUid: string;
    studentName: string;
    semester: number;
    section?: string;
  }): CuStudentSnapshot {
    const uid = params.studentUid.toUpperCase();
    const section = params.section?.trim() || `${uid.slice(0, 5)}-KRG-701-A`;
    const now = new Date();
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

    const attendance: CuAttendanceSnapshot[] = [
      {
        courseCode: CU_COURSES[0].courseCode,
        courseName: CU_COURSES[0].courseName,
        facultyName: CU_COURSES[0].facultyName,
        attendedClasses: 34,
        deliveredClasses: 40,
        dutyLeave: 2,
        minRequired: 75,
        lastLectureAt: hoursAgo(3),
        lastStatus: 'PRESENT',
      },
      {
        courseCode: CU_COURSES[1].courseCode,
        courseName: CU_COURSES[1].courseName,
        facultyName: CU_COURSES[1].facultyName,
        attendedClasses: 27,
        deliveredClasses: 38,
        dutyLeave: 0,
        minRequired: 75,
        lastLectureAt: hoursAgo(5),
        lastStatus: 'ABSENT',
      },
      {
        courseCode: CU_COURSES[2].courseCode,
        courseName: CU_COURSES[2].courseName,
        facultyName: CU_COURSES[2].facultyName,
        attendedClasses: 29,
        deliveredClasses: 36,
        dutyLeave: 1,
        minRequired: 75,
        lastLectureAt: hoursAgo(22),
        lastStatus: 'PRESENT',
      },
      {
        courseCode: CU_COURSES[3].courseCode,
        courseName: CU_COURSES[3].courseName,
        facultyName: CU_COURSES[3].facultyName,
        attendedClasses: 31,
        deliveredClasses: 34,
        dutyLeave: 0,
        minRequired: 75,
        lastLectureAt: hoursAgo(26),
        lastStatus: 'PRESENT',
      },
      {
        courseCode: CU_COURSES[4].courseCode,
        courseName: CU_COURSES[4].courseName,
        facultyName: CU_COURSES[4].facultyName,
        attendedClasses: 17,
        deliveredClasses: 24,
        dutyLeave: 1,
        minRequired: 75,
        lastLectureAt: hoursAgo(48),
        lastStatus: 'DUTY_LEAVE',
      },
      {
        courseCode: CU_COURSES[5].courseCode,
        courseName: CU_COURSES[5].courseName,
        facultyName: CU_COURSES[5].facultyName,
        attendedClasses: 22,
        deliveredClasses: 24,
        dutyLeave: 0,
        minRequired: 75,
        lastLectureAt: hoursAgo(28),
        lastStatus: 'PRESENT',
      },
    ];

    const timetable: CuTimetableSnapshot[] = [
      // Monday (1) to Saturday (6)
      { dayOfWeek: 1, startTime: '09:30', endTime: '10:20', courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', room: 'Block B3 - 405', facultyName: 'Dr. Harpreet Kaur', slotType: 'LECTURE', section },
      { dayOfWeek: 1, startTime: '10:25', endTime: '11:15', courseCode: '23CST-302', courseName: 'Operating Systems', room: 'Block B1 - 312', facultyName: 'Prof. Vikramjit Singh', slotType: 'LECTURE', section },
      { dayOfWeek: 1, startTime: '11:20', endTime: '13:00', courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', room: 'Block D5 (AIT) - Lab 102', facultyName: 'Er. Amanpreet Sidhu', slotType: 'LAB', section },
      { dayOfWeek: 1, startTime: '14:00', endTime: '14:50', courseCode: '23CSH-304', courseName: 'Computer Networks', room: 'Block B3 - 409', facultyName: 'Dr. Meenakshi Sharma', slotType: 'LECTURE', section },

      { dayOfWeek: 2, startTime: '09:30', endTime: '10:20', courseCode: '23CST-302', courseName: 'Operating Systems', room: 'Block B1 - 312', facultyName: 'Prof. Vikramjit Singh', slotType: 'LECTURE', section },
      { dayOfWeek: 2, startTime: '10:25', endTime: '11:15', courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', room: 'Block B3 - 405', facultyName: 'Dr. Harpreet Kaur', slotType: 'LECTURE', section },
      { dayOfWeek: 2, startTime: '11:20', endTime: '12:10', courseCode: '23TDP-301', courseName: 'Aptitude & Campus Placement Prep (TPP)', room: 'Block C2 - Seminar Hall 2', facultyName: 'Prof. Rohit Verma', slotType: 'TUTORIAL', section },
      { dayOfWeek: 2, startTime: '13:55', endTime: '15:35', courseCode: '23CSR-308', courseName: 'Competitive Coding & Problem Solving Lab', room: 'Block B3 - Lab 302', facultyName: 'Er. Simranjeet Gill', slotType: 'LAB', section },

      { dayOfWeek: 3, startTime: '09:30', endTime: '11:10', courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', room: 'Block B3 - Lab 204', facultyName: 'Dr. Harpreet Kaur', slotType: 'LAB', section },
      { dayOfWeek: 3, startTime: '11:20', endTime: '12:10', courseCode: '23CSH-304', courseName: 'Computer Networks', room: 'Block B3 - 409', facultyName: 'Dr. Meenakshi Sharma', slotType: 'LECTURE', section },
      { dayOfWeek: 3, startTime: '13:05', endTime: '13:55', courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', room: 'Block D5 (AIT) - 201', facultyName: 'Er. Amanpreet Sidhu', slotType: 'LECTURE', section },
      { dayOfWeek: 3, startTime: '14:00', endTime: '14:50', courseCode: '23CST-302', courseName: 'Operating Systems', room: 'Block B1 - 312', facultyName: 'Prof. Vikramjit Singh', slotType: 'LECTURE', section },

      { dayOfWeek: 4, startTime: '09:30', endTime: '10:20', courseCode: '23CSH-304', courseName: 'Computer Networks', room: 'Block B3 - 409', facultyName: 'Dr. Meenakshi Sharma', slotType: 'LECTURE', section },
      { dayOfWeek: 4, startTime: '10:25', endTime: '12:05', courseCode: '23CST-302', courseName: 'Operating Systems', room: 'Block B1 - Lab 108', facultyName: 'Prof. Vikramjit Singh', slotType: 'LAB', section },
      { dayOfWeek: 4, startTime: '13:05', endTime: '13:55', courseCode: '23TDP-301', courseName: 'Aptitude & Campus Placement Prep (TPP)', room: 'Block C2 - Seminar Hall 2', facultyName: 'Prof. Rohit Verma', slotType: 'LECTURE', section },
      { dayOfWeek: 4, startTime: '14:00', endTime: '14:50', courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', room: 'Block B3 - 405', facultyName: 'Dr. Harpreet Kaur', slotType: 'LECTURE', section },

      { dayOfWeek: 5, startTime: '09:30', endTime: '10:20', courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', room: 'Block D5 (AIT) - 201', facultyName: 'Er. Amanpreet Sidhu', slotType: 'LECTURE', section },
      { dayOfWeek: 5, startTime: '10:25', endTime: '12:05', courseCode: '23CSH-304', courseName: 'Computer Networks', room: 'Block B3 - Lab 210', facultyName: 'Dr. Meenakshi Sharma', slotType: 'LAB', section },
      { dayOfWeek: 5, startTime: '13:05', endTime: '14:45', courseCode: '23CSR-308', courseName: 'Competitive Coding & Problem Solving Lab', room: 'Block B3 - Lab 302', facultyName: 'Er. Simranjeet Gill', slotType: 'LAB', section },

      { dayOfWeek: 6, startTime: '10:00', endTime: '11:40', courseCode: '23TDP-301', courseName: 'Aptitude & Campus Placement Prep (TPP)', room: 'Block C2 - Seminar Hall 2', facultyName: 'Prof. Rohit Verma', slotType: 'TUTORIAL', section },
      { dayOfWeek: 6, startTime: '11:50', endTime: '13:30', courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', room: 'Block D5 (AIT) - Lab 102', facultyName: 'Er. Amanpreet Sidhu', slotType: 'LAB', section },
    ];

    const sem = params.semester;
    const marks: CuMarkSnapshot[] = [
      { semester: sem, courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', assessmentName: 'MST-1', category: 'THEORY', obtainedMarks: 18, maxMarks: 20, weightage: 10, publishedAt: hoursAgo(240) },
      { semester: sem, courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', assessmentName: 'Assignment 1', category: 'INTERNAL', obtainedMarks: 9.5, maxMarks: 10, weightage: 5, publishedAt: hoursAgo(120) },
      { semester: sem, courseCode: '23CSH-301', courseName: 'Design & Analysis of Algorithms', assessmentName: 'Lab Worksheet 1-4', category: 'PRACTICAL', obtainedMarks: 28, maxMarks: 30, weightage: 15, publishedAt: hoursAgo(48) },

      { semester: sem, courseCode: '23CST-302', courseName: 'Operating Systems', assessmentName: 'MST-1', category: 'THEORY', obtainedMarks: 15.5, maxMarks: 20, weightage: 10, publishedAt: hoursAgo(235) },
      { semester: sem, courseCode: '23CST-302', courseName: 'Operating Systems', assessmentName: 'Surprise Test', category: 'INTERNAL', obtainedMarks: 10, maxMarks: 12, weightage: 6, publishedAt: hoursAgo(90) },

      { semester: sem, courseCode: '23CSH-304', courseName: 'Computer Networks', assessmentName: 'MST-1', category: 'THEORY', obtainedMarks: 17, maxMarks: 20, weightage: 10, publishedAt: hoursAgo(220) },
      { semester: sem, courseCode: '23CSH-304', courseName: 'Computer Networks', assessmentName: 'Packet Tracer Practical', category: 'PRACTICAL', obtainedMarks: 27.5, maxMarks: 30, weightage: 15, publishedAt: hoursAgo(60) },

      { semester: sem, courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', assessmentName: 'MST-1', category: 'THEORY', obtainedMarks: 19, maxMarks: 20, weightage: 10, publishedAt: hoursAgo(210) },
      { semester: sem, courseCode: '23CSH-305', courseName: 'Full Stack Web & Mobile Dev', assessmentName: 'Mini Project Sprint 1', category: 'PRACTICAL', obtainedMarks: 29, maxMarks: 30, weightage: 15, publishedAt: hoursAgo(36) },

      { semester: sem, courseCode: '23TDP-301', courseName: 'Aptitude & Campus Placement Prep (TPP)', assessmentName: 'AMCAT Diagnostic 1', category: 'INTERNAL', obtainedMarks: 84, maxMarks: 100, weightage: 20, publishedAt: hoursAgo(72) },

      { semester: sem, courseCode: '23CSR-308', courseName: 'Competitive Coding & Problem Solving Lab', assessmentName: 'CodeChef Lab Contest 1', category: 'PRACTICAL', obtainedMarks: 46, maxMarks: 50, weightage: 25, publishedAt: hoursAgo(30) },
    ];

    const alerts: CuAlertSnapshot[] = [
      {
        externalRef: `cuims-att-${uid}-init-1`,
        portalSource: 'CUIMS',
        category: 'ATTENDANCE',
        courseCode: '23CST-302',
        title: 'CUIMS Attendance Alert · Operating Systems (71.1%)',
        body: 'Your attendance in 23CST-302 is 27/38 (71.1%), below the 75% CUIMS requirement. Attend the next 6 lectures consecutively to reach 75%.',
        actionUrl: 'https://uims.cuchd.in',
        publishedAt: hoursAgo(5),
      },
      {
        externalRef: `culms-assign-${uid}-init-2`,
        portalSource: 'CU_LMS',
        category: 'ASSIGNMENT',
        courseCode: '23CSH-301',
        title: 'CU LMS · New Assignment Uploaded (Dynamic Programming)',
        body: 'Dr. Harpreet Kaur posted "Assignment 2: DP & Greedy Proofs" on lms.cuchd.in. Submission closes Friday 11:59 PM.',
        actionUrl: 'https://lms.cuchd.in',
        publishedAt: hoursAgo(12),
      },
      {
        externalRef: `cuims-marks-${uid}-init-3`,
        portalSource: 'CUIMS',
        category: 'MARKS',
        courseCode: '23CSR-308',
        title: 'CUIMS Marks Uploaded · Competitive Coding Lab',
        body: 'CodeChef Lab Contest 1 marks published: 46 / 50 (92%). Check your internal breakdown.',
        actionUrl: 'https://uims.cuchd.in',
        publishedAt: hoursAgo(30),
      },
      {
        externalRef: `cuims-exam-${uid}-init-4`,
        portalSource: 'CUIMS',
        category: 'EXAM',
        title: 'DSW & Examination Wing · MST-2 Seating Plan Live',
        body: 'MST-2 seating plan for Gharuan Campus (Blocks B1, B3 & D5) has been published on CUIMS.',
        actionUrl: 'https://uims.cuchd.in',
        publishedAt: hoursAgo(40),
      },
    ];

    return {
      studentUid: uid,
      studentName: params.studentName,
      program: this.inferProgram(uid),
      semester: sem,
      section,
      attendance,
      timetable,
      marks,
      alerts,
    };
  }
}
