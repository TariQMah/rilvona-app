export type Page<T> = {
  data: T[];
  meta: { hasMore: boolean; nextCursor: string | null };
};

export type SessionUser = {
  id: string;
  email: string;
  role: 'STUDENT' | 'COMMUNITY_MODERATOR' | 'COLLEGE_ADMIN' | 'PLATFORM_ADMIN';
  status: 'ACTIVE' | 'DEACTIVATED' | 'DELETED';
  collegeId: string | null;
  emailVerified: boolean;
  displayName: string;
  username: string;
};

export type AuthResult = {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string };
  devOtp?: string;
};

export type Author = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

export type Post = {
  id: string;
  body: string;
  visibility: 'PUBLIC' | 'COLLEGE' | 'COMMUNITY';
  createdAt: string;
  author: Author;
  community: { id: string; name: string; slug: string } | null;
  college: { id: string; name: string; slug: string } | null;
  media: { id: string; mimeType: string; url: string | null }[];
  counts: { likes: number; comments: number };
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  sharePath: string;
};

export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: Author;
};

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'COLLEGE' | 'DEPARTMENT' | 'INTEREST';
  visibility: 'PUBLIC' | 'RESTRICTED';
  collegeId: string | null;
  memberCount: number;
};

export type CommunityDetail = Community & {
  rules: string;
  college: { id: string; name: string; slug: string } | null;
  membership: { status: string; role: string } | null;
  moderators: { displayName: string; username: string }[];
};

export type QuestionSummary = {
  id: string;
  title: string;
  body: string;
  pseudonym: string;
  createdAt: string;
  answerCount: number;
  accepted: boolean;
  askedByMe: boolean;
};

export type Answer = {
  id: string;
  body: string;
  pseudonym: string;
  score: number;
  createdAt: string;
  accepted: boolean;
};

export type QuestionDetail = {
  id: string;
  title: string;
  body: string;
  pseudonym: string;
  createdAt: string;
  acceptedAnswerId: string | null;
  askedByMe: boolean;
  answers: Answer[];
};

export type CampusEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  scope: 'COLLEGE' | 'INTERCOLLEGE';
  status: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  registeredCount: number;
  college: { id: string; name: string; slug: string } | null;
  organizer: { id: string; displayName: string; username: string };
  myStatus: string | null;
  sharePath: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type College = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  emailDomain: string | null;
  allowsManualVerification: boolean;
};

export type Me = {
  id: string;
  email: string;
  phone: string | null;
  role: SessionUser['role'];
  status: SessionUser['status'];
  emailVerified: boolean;
  college: { id: string; name: string; slug: string } | null;
  verificationStatus: string;
  profile: {
    displayName: string;
    username: string;
    bio: string | null;
    avatarUrl: string | null;
    course: string | null;
    graduationYear: number | null;
    interests: string[];
    skills: string[];
    profileVisibility: 'PUBLIC' | 'COLLEGE' | 'PRIVATE';
  } | null;
  notifications: {
    replies: boolean;
    community: boolean;
    events: boolean;
    moderation: boolean;
    security: boolean;
    lms?: boolean;
    pushEnabled: boolean;
  } | null;
};

export type AttendanceGuidance = {
  status: 'SAFE' | 'BORDERLINE' | 'SHORTAGE';
  canMiss: number;
  needToAttend: number;
  label: string;
};

export type AttendanceHistoryEntry = {
  date: string;
  timing: string;
  status: 'PRESENT' | 'ABSENT' | 'DUTY_LEAVE' | 'OTHER';
};

export type AttendanceCourse = {
  id: string;
  courseCode: string;
  courseName: string;
  facultyName: string | null;
  attendedClasses: number;
  deliveredClasses: number;
  dutyLeave: number;
  percentage: number;
  minRequired: number;
  lastLectureAt: string | null;
  lastStatus: string | null;
  guidance: AttendanceGuidance;
  history: AttendanceHistoryEntry[];
};

export type TimetableSlotItem = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  room: string;
  facultyName: string | null;
  slotType: string;
  section: string | null;
};

export type CourseMarkItem = {
  id: string;
  semester: number;
  courseCode: string;
  courseName: string;
  assessmentName: string;
  category: string;
  obtainedMarks: number;
  maxMarks: number;
  weightage: number | null;
  publishedAt: string;
};

export type LmsPortalAlertItem = {
  id: string;
  externalRef: string;
  portalSource: 'CUIMS' | 'CU_LMS' | string;
  category:
    | 'ATTENDANCE'
    | 'TIMETABLE'
    | 'MARKS'
    | 'ASSIGNMENT'
    | 'ANNOUNCEMENT'
    | 'EXAM';
  courseCode: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
  publishedAt: string;
};

export type PortalMentor = {
  name?: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  lines: string[];
};

export type PortalNotice = {
  kind: 'MESSAGE' | 'ANNOUNCEMENT' | 'NOTIFICATION';
  title: string;
  body?: string;
  date?: string;
};

export type AcademicsOverview =
  | {
      connected: false;
      demoAvailable: boolean;
      supportedColleges: {
        provider: 'CHANDIGARH_UNIVERSITY';
        name: string;
        loginUrl: string;
        portals: string[];
      }[];
    }
  | {
      connected: true;
      demoAvailable: boolean;
      connection: {
        id: string;
        provider: 'CHANDIGARH_UNIVERSITY';
        studentUid: string;
        studentName: string | null;
        program: string | null;
        semester: number;
        section: string | null;
        sectionGroup: string | null;
        /** The student's own portal photo as a data URI. */
        photo: string | null;
        mentor: PortalMentor | null;
        syncStatus: 'CONNECTED' | 'SYNCING' | 'ERROR' | 'DISCONNECTED';
        lastSyncedAt: string | null;
        isDemo: boolean;
        dataSource: string;
        college: { id: string; name: string; slug: string } | null;
      };
      notices: PortalNotice[];
      summary: {
        overallAttendance: number | null;
        totalAttended: number;
        totalDelivered: number;
        safeCourses: number;
        shortageCourses: number;
        averageScorePct: number | null;
        todayClasses: number;
        activeDay: number;
        alertCount: number;
      };
      attendance: AttendanceCourse[];
      timetable: TimetableSlotItem[];
      marks: CourseMarkItem[];
      alerts: LmsPortalAlertItem[];
    };

export type PublicProfile = {
  id: string;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  course: string | null;
  graduationYear: number | null;
  interests: string[];
  skills: string[];
  college: { id: string; name: string; slug: string } | null;
  verificationStatus: string;
};

export type SearchHit = {
  id: string;
  body?: string;
  name?: string;
  slug?: string;
  description?: string;
  title?: string;
  pseudonym?: string;
  location?: string;
  startsAt?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  createdAt?: string;
};
