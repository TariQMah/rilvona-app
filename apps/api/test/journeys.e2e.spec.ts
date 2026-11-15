import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { configureApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const password = "StudentPass1";

describe("HiiHive API journeys", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        moderation_actions, reports, notifications, device_tokens, answer_votes, answers, questions,
        event_registrations, events, bookmarks, reactions, comments, post_media, media_uploads, posts,
        community_memberships, communities, college_verifications, consent_records, otp_challenges,
        refresh_token_sessions, blocked_users, notification_preferences, user_profiles, audit_logs,
        users, colleges
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers, verifies, and signs in without accepting a client-supplied role", async () => {
    const tokens = await signup("ada@northwind.edu", "ada");
    const me = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set(auth(tokens.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.emailVerified).toBe(true);
    expect(me.body.data.role).toBe("STUDENT");
    expect(me.body.data.email).toBe("ada@northwind.edu");

    const bad = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "ada@northwind.edu", password });
    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it("signs in with Google only after the terms and privacy policy are accepted", async () => {
    const verify = jest
      .spyOn(
        AuthService.prototype as unknown as {
          verifyGoogleToken: () => Promise<unknown>;
        },
        "verifyGoogleToken",
      )
      .mockResolvedValue({
        sub: "g-1",
        email: "grace@northwind.edu",
        emailVerified: true,
        name: "Grace Hopper",
      });
    const token = "t".repeat(40);
    const refused = await request(app.getHttpServer())
      .post("/api/v1/auth/google")
      .send({ idToken: token });
    expect(refused.status).toBe(400);

    const first = await request(app.getHttpServer())
      .post("/api/v1/auth/google")
      .send({ idToken: token, acceptedTerms: true, acceptedPrivacy: true });
    expect(first.status).toBe(200);
    expect(first.body.data.user).toMatchObject({
      email: "grace@northwind.edu",
      displayName: "Grace Hopper",
      username: "grace",
      emailVerified: true,
      role: "STUDENT",
    });
    const again = await request(app.getHttpServer())
      .post("/api/v1/auth/google")
      .send({ idToken: token, acceptedTerms: true, acceptedPrivacy: true });
    expect(again.body.data.user.id).toBe(first.body.data.user.id);
    expect(await prisma.consentRecord.count()).toBe(1);
    verify.mockRestore();
  });

  it("completes a profile, verifies a college email, and joins a community", async () => {
    const college = await prisma.college.create({
      data: {
        name: "Northwind Institute",
        slug: "northwind",
        city: "Pune",
        state: "Maharashtra",
        emailDomain: "northwind.edu",
      },
    });
    const tokens = await signup("ada@northwind.edu", "ada");
    const profile = await request(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set(auth(tokens.accessToken))
      .send({
        course: "Computer Science",
        graduationYear: 2028,
        interests: ["music", "football"],
      });
    expect(profile.status).toBe(200);
    expect(profile.body.data.profile.course).toBe("Computer Science");

    const verification = await request(app.getHttpServer())
      .post("/api/v1/verification")
      .set(auth(tokens.accessToken))
      .send({ collegeId: college.id, method: "COLLEGE_EMAIL" });
    expect(verification.status).toBe(201);
    expect(verification.body.data.status).toBe("VERIFIED");

    const adminTokens = await signup(
      "admin@hiihive.local",
      "hiihiveadmin",
      "Admin",
    );
    await prisma.user.update({
      where: { email: "admin@hiihive.local" },
      data: { role: "PLATFORM_ADMIN" },
    });
    const community = await request(app.getHttpServer())
      .post("/api/v1/communities")
      .set(auth(adminTokens.accessToken))
      .send({
        name: "Northwind General",
        slug: "northwind-general",
        description: "Campus conversation",
        rules: "Be kind",
        category: "COLLEGE",
        visibility: "PUBLIC",
        collegeId: college.id,
      });
    expect(community.status).toBe(201);
    const joined = await request(app.getHttpServer())
      .post("/api/v1/communities/northwind-general/join")
      .set(auth(tokens.accessToken));
    expect(joined.body.data.status).toBe("ACTIVE");

    const secret = await request(app.getHttpServer())
      .post("/api/v1/communities")
      .set(auth(adminTokens.accessToken))
      .send({
        name: "Hostel",
        slug: "northwind-hostel",
        description: "Residents",
        rules: "Members only",
        category: "INTEREST",
        visibility: "RESTRICTED",
        collegeId: college.id,
      });
    expect(secret.status).toBe(201);
    const hidden = await request(app.getHttpServer())
      .get("/api/v1/communities/northwind-hostel")
      .set(auth(tokens.accessToken));
    expect(hidden.status).toBe(404);
  });

  it("creates a post and receives a comment", async () => {
    const author = await signup("ada@northwind.edu", "ada");
    const commenter = await signup("grace@northwind.edu", "grace");
    const created = await request(app.getHttpServer())
      .post("/api/v1/posts")
      .set(auth(author.accessToken))
      .send({ body: "First day on campus", visibility: "PUBLIC" });
    expect(created.status).toBe(201);
    const postId = created.body.data.id as string;
    const comment = await request(app.getHttpServer())
      .post(`/api/v1/posts/${postId}/comments`)
      .set(auth(commenter.accessToken))
      .send({ body: "Welcome @ada" });
    expect(comment.status).toBe(201);
    const notes = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set(auth(author.accessToken));
    expect(
      notes.body.data.some(
        (item: { type: string }) =>
          item.type === "REPLY" || item.type === "MENTION",
      ),
    ).toBe(true);
    const feed = await request(app.getHttpServer())
      .get("/api/v1/feed")
      .set(auth(author.accessToken));
    expect(feed.body.data).toHaveLength(1);
    expect(feed.body.meta.hasMore).toBe(false);
  });

  it("keeps anonymous questions private from students and reveals them only to a platform admin", async () => {
    const asker = await signup("ada@northwind.edu", "ada");
    const answerer = await signup("grace@northwind.edu", "grace");
    const created = await request(app.getHttpServer())
      .post("/api/v1/questions")
      .set(auth(asker.accessToken))
      .send({
        title: "Where is the quiet library?",
        body: "Looking for a place to study after 8.",
      });
    expect(created.status).toBe(201);
    const questionId = created.body.data.id as string;
    expect(JSON.stringify(created.body)).not.toContain("ada@northwind.edu");
    expect(created.body.data.authorId).toBeUndefined();

    const answer = await request(app.getHttpServer())
      .post(`/api/v1/questions/${questionId}/answers`)
      .set(auth(answerer.accessToken))
      .send({ body: "The east reading room stays open late." });
    const answerId = answer.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/answers/${answerId}/vote`)
      .set(auth(asker.accessToken))
      .send({ value: 1 });
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/questions/${questionId}/accept`)
      .set(auth(asker.accessToken))
      .send({ answerId });
    expect(accepted.status).toBe(201);

    const viewed = await request(app.getHttpServer())
      .get(`/api/v1/questions/${questionId}`)
      .set(auth(answerer.accessToken));
    expect(JSON.stringify(viewed.body)).not.toContain("ada@northwind.edu");
    expect(viewed.body.data.answers[0].authorId).toBeUndefined();
    expect(viewed.body.data.acceptedAnswerId).toBe(answerId);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/admin/questions/${questionId}/identity`)
      .set(auth(answerer.accessToken))
      .send({ reason: "Investigating harassment report" });
    expect(denied.status).toBe(403);

    await prisma.user.update({
      where: { email: "grace@northwind.edu" },
      data: { role: "PLATFORM_ADMIN" },
    });
    const revealed = await request(app.getHttpServer())
      .post(`/api/v1/admin/questions/${questionId}/identity`)
      .set(auth(answerer.accessToken))
      .send({ reason: "Safety investigation for harassment" });
    expect(revealed.status).toBe(201);
    expect(revealed.body.data.email).toBe("ada@northwind.edu");
    expect(
      await prisma.auditLog.count({ where: { action: "IDENTITY_REVEALED" } }),
    ).toBe(1);
  });

  it("enforces event capacity and rejects duplicate registrations", async () => {
    const host = await signup("ada@northwind.edu", "ada");
    const guest = await signup("grace@northwind.edu", "grace");
    const college = await prisma.college.create({
      data: {
        name: "Northwind Institute",
        slug: "northwind",
        city: "Pune",
        state: "Maharashtra",
        emailDomain: "northwind.edu",
      },
    });
    await prisma.user.update({
      where: { email: "ada@northwind.edu" },
      data: { collegeId: college.id },
    });
    const startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const event = await request(app.getHttpServer())
      .post("/api/v1/events")
      .set(auth(host.accessToken))
      .send({
        title: "Design jam",
        description: "Bring a laptop",
        location: "Studio 2",
        startsAt,
        endsAt,
        capacity: 1,
        waitlistEnabled: false,
      });
    expect(event.status).toBe(201);
    const eventId = event.body.data.id as string;
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/events/${eventId}/register`)
          .set(auth(host.accessToken))
      ).status,
    ).toBe(201);
    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/register`)
      .set(auth(host.accessToken));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ALREADY_REGISTERED");
    const full = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/register`)
      .set(auth(guest.accessToken));
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("EVENT_FULL");
    await expect(
      prisma.eventRegistration.create({
        data: {
          eventId,
          userId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: "ada@northwind.edu" },
            })
          ).id,
          status: "REGISTERED",
        },
      }),
    ).rejects.toThrow();
    const checked = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set(auth(host.accessToken))
      .send({});
    expect(checked.body.data.status).toBe("ATTENDED");
  });

  it("likes a post once, hides blocked people, and applies a moderation action", async () => {
    const author = await signup("ada@northwind.edu", "ada");
    const reader = await signup("grace@northwind.edu", "grace");
    const post = await request(app.getHttpServer())
      .post("/api/v1/posts")
      .set(auth(author.accessToken))
      .send({ body: "Looking for a project team", visibility: "PUBLIC" });
    const postId = post.body.data.id as string;
    await request(app.getHttpServer())
      .put(`/api/v1/posts/${postId}/reaction`)
      .set(auth(reader.accessToken));
    await request(app.getHttpServer())
      .put(`/api/v1/posts/${postId}/reaction`)
      .set(auth(reader.accessToken));
    expect(await prisma.reaction.count()).toBe(1);
    await expect(
      prisma.reaction.create({
        data: {
          userId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: "grace@northwind.edu" },
            })
          ).id,
          postId,
          type: "LIKE",
        },
      }),
    ).rejects.toThrow();

    await request(app.getHttpServer())
      .post("/api/v1/users/ada/block")
      .set(auth(reader.accessToken));
    const feed = await request(app.getHttpServer())
      .get("/api/v1/feed")
      .set(auth(reader.accessToken));
    expect(feed.body.data).toHaveLength(0);
    const found = await request(app.getHttpServer())
      .get("/api/v1/search")
      .query({ q: "project", type: "posts" })
      .set(auth(reader.accessToken));
    expect(found.body.data).toHaveLength(0);

    const report = await request(app.getHttpServer())
      .post("/api/v1/reports")
      .set(auth(reader.accessToken))
      .send({
        targetType: "POST",
        targetId: postId,
        reason: "Spam",
      });
    expect(report.status).toBe(201);
    await prisma.user.update({
      where: { email: "grace@northwind.edu" },
      data: { role: "PLATFORM_ADMIN" },
    });
    const action = await request(app.getHttpServer())
      .post("/api/v1/admin/moderation")
      .set(auth(reader.accessToken))
      .send({
        reportId: report.body.data.id,
        action: "REMOVE_CONTENT",
        targetType: "POST",
        targetId: postId,
        notes: "Spam removed",
      });
    expect(action.status).toBe(201);
    const after = await request(app.getHttpServer()).get("/api/v1/feed/public");
    expect(after.body.data).toHaveLength(0);
    expect(
      await prisma.auditLog.count({
        where: { action: "MODERATION_REMOVE_CONTENT" },
      }),
    ).toBe(1);
  });

  it("revokes a refresh session, detects reuse, and allows a new sign-in", async () => {
    const tokens = await signup("ada@northwind.edu", "ada");
    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: tokens.refreshToken });
    expect(rotated.status).toBe(201);
    const reused = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: tokens.refreshToken });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("REFRESH_REUSE");
    const next = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.data.tokens.refreshToken });
    expect(next.status).toBe(401);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "ada@northwind.edu", password });
    expect(login.status).toBe(200);
    const loggedOut = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: login.body.data.tokens.refreshToken });
    expect(loggedOut.body.data.revoked).toBe(true);
    const denied = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: login.body.data.tokens.refreshToken });
    expect(denied.status).toBe(401);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "ada@northwind.edu", password: "StudentPass9" });
    }
    const locked = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "ada@northwind.edu", password });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("exports and deletes an account, then refuses the old login", async () => {
    const tokens = await signup("ada@northwind.edu", "ada");
    const exported = await request(app.getHttpServer())
      .get("/api/v1/users/me/export")
      .set(auth(tokens.accessToken));
    expect(exported.status).toBe(200);
    expect(exported.body.data.account.email).toBe("ada@northwind.edu");
    expect(exported.body.data.account.passwordHash).toBeUndefined();

    const removed = await request(app.getHttpServer())
      .delete("/api/v1/users/me")
      .set(auth(tokens.accessToken));
    expect(removed.body.data.deleted).toBe(true);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "ada@northwind.edu", password });
    expect(login.status).toBe(401);
    const profile = await request(app.getHttpServer()).get("/api/v1/users/ada");
    expect(profile.status).toBe(404);
    const tombstone = await prisma.user.findFirst({
      where: { status: "DELETED" },
    });
    expect(tombstone?.email).toContain("@deleted.hiihive.invalid");
    expect(tombstone?.passwordHash).toBe("deleted");
  });

  it("never lets two students share a username, however it is spelled or raced", async () => {
    const register = (email: string, username: string) =>
      request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email,
          password,
          displayName: "Sam Student",
          username,
          acceptedTerms: true,
          acceptedPrivacy: true,
        });

    const first = await register("sam1@northwind.edu", "sam_unique");
    expect(first.status).toBe(201);

    const same = await register("sam2@northwind.edu", "sam_unique");
    expect(same.status).toBe(409);
    expect(same.body.error.code).toBe("USERNAME_IN_USE");

    const otherCase = await register("sam3@northwind.edu", "SAM_Unique");
    expect(otherCase.status).toBe(409);
    expect(otherCase.body.error.code).toBe("USERNAME_IN_USE");

    // the same name arriving twice at the same moment: exactly one wins, the other gets a clean 409, never a 500
    const [a, b] = await Promise.all([
      register("race1@northwind.edu", "race_name"),
      register("race2@northwind.edu", "race_name"),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe("USERNAME_IN_USE");
    expect(
      await prisma.userProfile.count({ where: { username: "race_name" } }),
    ).toBe(1);

    // the database itself refuses a different spelling, even when the API is bypassed
    await expect(
      prisma.userProfile.create({
        data: {
          userId: "bypass-user",
          displayName: "X",
          username: "Sam_Unique",
        },
      }),
    ).rejects.toThrow();

    // reserved and placeholder names are refused
    expect(
      (await register("admin1@northwind.edu", "admin")).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await register("ghost@northwind.edu", "d0123456789abcdef012")).status,
    ).toBeGreaterThanOrEqual(400);

    const check = (name: string) =>
      request(app.getHttpServer())
        .get("/api/v1/auth/username-available")
        .query({ username: name });
    expect((await check("sam_unique")).body.data).toEqual({
      available: false,
      reason: "taken",
    });
    expect((await check("Sam_Unique")).body.data).toEqual({
      available: false,
      reason: "taken",
    });
    expect((await check("hiihive")).body.data).toEqual({
      available: false,
      reason: "reserved",
    });
    expect((await check("no")).body.data).toEqual({
      available: false,
      reason: "invalid",
    });
    expect((await check("brand_new_name")).body.data).toEqual({
      available: true,
    });
  });

  async function signup(
    email: string,
    username: string,
    displayName = "Ada Lovelace",
  ) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email,
        password,
        displayName,
        username,
        acceptedTerms: true,
        acceptedPrivacy: true,
        role: "PLATFORM_ADMIN",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("STUDENT");
    const verified = await request(app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ email, code: response.body.data.devOtp });
    expect(verified.status).toBe(200);
    return response.body.data.tokens as {
      accessToken: string;
      refreshToken: string;
    };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }
});

void PrismaClient;
