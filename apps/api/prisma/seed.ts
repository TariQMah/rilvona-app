import { config as loadDotenv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

loadDotenv();

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }
  const colleges = [
    {
      name: 'Chandigarh University',
      slug: 'chandigarh-university',
      city: 'Mohali',
      state: 'Punjab',
      emailDomain: 'cuchd.in',
      allowsManualVerification: true,
    },
    {
      name: 'Northwind Institute',
      slug: 'northwind',
      city: 'Pune',
      state: 'Maharashtra',
      emailDomain: 'northwind.edu',
      allowsManualVerification: true,
    },
    {
      name: 'Riverside College',
      slug: 'riverside',
      city: 'Bengaluru',
      state: 'Karnataka',
      emailDomain: null,
      allowsManualVerification: true,
    },
  ];
  for (const college of colleges) {
    await prisma.college.upsert({
      where: { slug: college.slug },
      update: college,
      create: college,
    });
  }
  const cu = await prisma.college.findUniqueOrThrow({ where: { slug: 'chandigarh-university' } });
  const northwind = await prisma.college.findUniqueOrThrow({ where: { slug: 'northwind' } });
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.info('Skipping admin seed because SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is unset');
    return;
  }
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'PLATFORM_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), deletedAt: null },
    create: {
      email,
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      collegeId: northwind.id,
      profile: { create: { displayName: 'HiiHive Admin', username: 'hiihiveadmin' } },
      notificationPrefs: { create: {} },
    },
  });
  const fixtures = [
    ['cu-general', 'CU Campus General', 'Official Chandigarh University student square — Gharuan campus updates, fests, and DSW news.', 'Be respectful and keep discussions constructive.', 'COLLEGE', 'PUBLIC', cu.id],
    ['cu-apex-cse', 'CU CSE & AIT', 'Chandigarh University CSE, AI/ML, and Apex Institute of Technology discussions, labs, and hackathons.', 'Share code, resources, and lab updates.', 'DEPARTMENT', 'PUBLIC', cu.id],
    ['cu-placements', 'CU Placements & Internships', 'TPP drives, AMCAT/CoCubes prep, and interview experiences at Chandigarh University.', 'Verified drive info only.', 'INTEREST', 'PUBLIC', cu.id],
    ['northwind-general', 'Northwind General', 'Campus-wide conversation for Northwind.', 'Be respectful and specific.', 'COLLEGE', 'PUBLIC', northwind.id],
    ['northwind-cs', 'Computer Science', 'Department board for CS students.', 'Keep posts relevant to the department.', 'DEPARTMENT', 'PUBLIC', northwind.id],
    ['campus-music', 'Campus Music', 'Find people to play with.', 'No spam and no ticket selling.', 'INTEREST', 'PUBLIC', null],
    ['northwind-hostel', 'Northwind Hostel', 'Restricted hostel community.', 'Members only.', 'INTEREST', 'RESTRICTED', northwind.id],
  ] as const;
  for (const [slug, name, description, rules, category, visibility, collegeId] of fixtures) {
    await prisma.community.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        description,
        rules,
        category,
        visibility,
        collegeId,
        createdById: admin.id,
        memberships: { create: { userId: admin.id, role: 'MODERATOR', status: 'ACTIVE' } },
      },
    });
  }
  console.info(`Seeded colleges and admin ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
