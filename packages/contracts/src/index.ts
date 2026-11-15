import { z } from "zod";

export const TERMS_VERSION = "2026-10-20";
export const PRIVACY_VERSION = "2026-10-20";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

/** Names nobody may take: they look official, or are used by the app itself. Compared in lowercase. */
export const RESERVED_USERNAMES = [
  "me",
  "admin",
  "administrator",
  "support",
  "help",
  "hiihive",
  "rilvona",
  "rilvona_official",
  "hii_hive",
  "hive",
  "team",
  "staff",
  "official",
  "moderator",
  "mod",
  "security",
  "system",
  "root",
  "api",
  "null",
  "undefined",
  "deleted",
  "student",
  "anonymous",
  "cuims",
  "chandigarh_university",
  "cu_official",
];

/** Deleted accounts keep a placeholder name of this shape (`d` + 19 hex characters); nobody may register one. */
const DELETED_PLACEHOLDER = /^d[0-9a-f]{19}$/;

export function isReservedUsername(username: string): boolean {
  const name = username.trim().toLowerCase();
  return RESERVED_USERNAMES.includes(name) || DELETED_PLACEHOLDER.test(name);
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Use 3-20 letters, numbers, or underscores")
  .refine((value) => !isReservedUsername(value), "That username is reserved");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email")
  .max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(40),
  username: usernameSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Accept the terms to continue" }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "Accept the privacy policy to continue" }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const requestEmailSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  password: passwordSchema,
});

export const reactivateSchema = loginSchema;

/** The only sign in method: a Google ID token from the phone, plus the student agreeing to the terms and privacy policy. */
export const googleSignInSchema = z.object({
  idToken: z.string().min(20).max(4096),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Accept the terms to continue" }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "Accept the privacy policy to continue" }),
  }),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  course: z.string().trim().max(80).nullable().optional(),
  graduationYear: z.number().int().min(2000).max(2040).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
  skills: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
  profileVisibility: z.enum(["PUBLIC", "COLLEGE", "PRIVATE"]).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

export const notificationPrefsSchema = z.object({
  replies: z.boolean().optional(),
  community: z.boolean().optional(),
  events: z.boolean().optional(),
  moderation: z.boolean().optional(),
  security: z.boolean().optional(),
  lms: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export const cuUidSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    // Chandigarh and Lucknow campus UIDs, e.g. 23BCS10452: letters and digits, no spaces or symbols.
    /^[0-9A-Z]{6,20}$/,
    "Enter your CU UID (for example 23BCS10452)",
  );

/**
 * Raw tables read from the student's own logged-in CUIMS session on their device.
 * No passwords are ever part of this payload.
 */
export const importLmsSchema = z.object({
  provider: z.enum(["CHANDIGARH_UNIVERSITY"]).default("CHANDIGARH_UNIVERSITY"),
  studentUid: cuUidSchema,
  sourceUrl: z.string().max(500),
  pageTitle: z.string().max(200).default(""),
  studentName: z.string().trim().max(120).optional(),
  tables: z
    .array(
      z.object({
        caption: z.string().max(200).optional(),
        headers: z.array(z.string().max(200)).max(40),
        rows: z.array(z.array(z.string().max(300)).max(40)).max(300),
      }),
    )
    .max(25),
  attendanceLog: z
    .array(
      z.object({
        title: z.string().max(200),
        code: z.string().max(60).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        timing: z.string().max(80).default(""),
        status: z.enum(["PRESENT", "ABSENT", "DUTY_LEAVE", "OTHER"]),
      }),
    )
    .max(4000)
    .optional(),
  /** The student's own dashboard extras: header name/photo, section, mentor card, portal notices. */
  profile: z
    .object({
      name: z.string().trim().max(120).optional(),
      semester: z.number().int().min(1).max(12).optional(),
      section: z.string().trim().max(60).optional(),
      group: z.string().trim().max(60).optional(),
      photo: z
        .string()
        .max(600_000)
        .regex(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/)
        .optional(),
      mentor: z
        .object({
          name: z.string().max(80).optional(),
          designation: z.string().max(80).optional(),
          department: z.string().max(80).optional(),
          phone: z.string().max(30).optional(),
          email: z.string().max(120).optional(),
          lines: z.array(z.string().max(120)).max(12).default([]),
        })
        .optional(),
      notices: z
        .array(
          z.object({
            kind: z.enum(["MESSAGE", "ANNOUNCEMENT", "NOTIFICATION"]),
            title: z.string().max(160),
            body: z.string().max(400).optional(),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          }),
        )
        .max(40)
        .default([]),
    })
    .optional(),
});

export const simulateLmsEventSchema = z.object({
  kind: z.enum([
    "ATTENDANCE_MARKED",
    "MARKS_UPLOADED",
    "TIMETABLE_CHANGED",
    "LMS_ASSIGNMENT",
    "CUIMS_ANNOUNCEMENT",
  ]),
  courseCode: z.string().trim().max(24).optional(),
});

export const verificationRequestSchema = z.object({
  collegeId: z.string().uuid(),
  method: z.enum(["COLLEGE_EMAIL", "MANUAL"]),
  note: z.string().trim().max(500).optional(),
});

export const verificationReviewSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export const createPostSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    visibility: z.enum(["PUBLIC", "COLLEGE", "COMMUNITY"]).default("PUBLIC"),
    communityId: z.string().uuid().optional(),
    mediaIds: z.array(z.string().uuid()).max(4).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.visibility === "COMMUNITY" && !value.communityId) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a community",
        path: ["communityId"],
      });
    }
  });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

export const createCommunitySchema = z.object({
  name: z.string().trim().min(3).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens",
    ),
  description: z.string().trim().min(1).max(500),
  rules: z.string().trim().min(1).max(2000),
  category: z.enum(["COLLEGE", "DEPARTMENT", "INTEREST"]),
  visibility: z.enum(["PUBLIC", "RESTRICTED"]),
  collegeId: z.string().uuid().nullable().optional(),
});

export const membershipDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

export const createQuestionSchema = z.object({
  title: z.string().trim().min(8).max(140),
  body: z.string().trim().min(1).max(5000),
  communityId: z.string().uuid().optional(),
});

export const createAnswerSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const createEventSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(1).max(5000),
    location: z.string().trim().min(1).max(200),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    scope: z.enum(["COLLEGE", "INTERCOLLEGE"]).default("COLLEGE"),
    capacity: z.number().int().positive().max(100000).nullable().optional(),
    waitlistEnabled: z.boolean().default(false),
    collegeId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "End time must be after the start time",
        path: ["endsAt"],
      });
    }
  });

export const checkInSchema = z.object({
  userId: z.string().uuid().optional(),
});

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(8).max(512),
  platform: z.enum(["IOS", "ANDROID"]),
});

export const reportSchema = z.object({
  targetType: z.enum([
    "POST",
    "COMMENT",
    "QUESTION",
    "ANSWER",
    "USER",
    "EVENT",
    "COMMUNITY",
  ]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().max(1000).optional(),
});

export const moderationSchema = z.object({
  reportId: z.string().uuid().optional(),
  action: z.enum([
    "DISMISS",
    "REMOVE_CONTENT",
    "WARN_USER",
    "BAN_MEMBER",
    "SUSPEND_USER",
  ]),
  targetType: z.enum([
    "POST",
    "COMMENT",
    "QUESTION",
    "ANSWER",
    "USER",
    "EVENT",
    "COMMUNITY",
  ]),
  targetId: z.string().uuid(),
  communityId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const identityRevealSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  type: z.enum(["posts", "communities", "questions", "events", "people"]),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export const uploadSignSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

export const communityListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(["COLLEGE", "DEPARTMENT", "INTEREST"]).optional(),
  collegeId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const appPlatformSchema = z.enum(["ANDROID", "IOS"]);

export const appVersionQuerySchema = z.object({
  platform: appPlatformSchema,
  versionCode: z.coerce.number().int().min(0).max(100_000_000).default(0),
});

export const appVersionUpdateSchema = z
  .object({
    latestVersionCode: z.number().int().min(1).max(100_000_000),
    latestVersionName: z.string().trim().min(1).max(32),
    minVersionCode: z.number().int().min(1).max(100_000_000),
    forceUpdate: z.boolean(),
    releaseNotes: z.string().trim().max(2000),
    storeUrl: z.string().trim().max(500).refine((value) => value === "" || /^https?:\/\//.test(value), "Use a full https:// link"),
  })
  .refine((value) => value.minVersionCode <= value.latestVersionCode, {
    message: "The minimum version cannot be newer than the latest version",
    path: ["minVersionCode"],
  });

export type AppVersionUpdateInput = z.infer<typeof appVersionUpdateSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
export type VerificationRequestInput = z.infer<
  typeof verificationRequestSchema
>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
export type ImportLmsInput = z.infer<typeof importLmsSchema>;
export type SimulateLmsEventInput = z.infer<typeof simulateLmsEventSchema>;

export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20)
    .refine((items) => items[items.length - 1]?.role === "user", "The last message must be yours"),
  /** The phone's clock (UTC is fine) and IANA zone, so "tomorrow" means the student's tomorrow. */
  clientTime: z.string().datetime({ offset: true }).optional(),
  timezone: z
    .string()
    .max(64)
    .regex(/^[A-Za-z0-9_+\-/]+$/)
    .optional(),
});

export type AiChatInput = z.infer<typeof aiChatSchema>;
