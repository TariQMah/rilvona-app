import { AccountStatus, UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: UserRole;
  collegeId: string | null;
  status: AccountStatus;
  emailVerified: boolean;
};

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
};
