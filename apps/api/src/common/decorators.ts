import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const VERIFIED_KEY = 'emailVerified';
export const Verified = () => SetMetadata(VERIFIED_KEY, true);

export const ALLOW_DEACTIVATED = 'allowDeactivated';
export const AllowDeactivated = () => SetMetadata(ALLOW_DEACTIVATED, true);
