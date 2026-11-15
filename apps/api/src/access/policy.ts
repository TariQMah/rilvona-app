import { AuthUser } from '../common/auth-user';

export type VisibilityPost = {
  authorId: string;
  visibility: 'PUBLIC' | 'COLLEGE' | 'COMMUNITY';
  collegeId: string | null;
  communityId: string | null;
  communityVisibility: 'PUBLIC' | 'RESTRICTED' | null;
  deletedAt: Date | null;
};

export function canViewPost(input: {
  viewer: Pick<AuthUser, 'id' | 'collegeId'> | null;
  post: VisibilityPost;
  blocked: boolean;
  isMember: boolean;
}) {
  if (input.post.deletedAt || input.blocked) return false;
  if (input.viewer && input.viewer.id === input.post.authorId) return true;
  if (input.post.communityId) {
    if (input.post.communityVisibility === 'RESTRICTED') return input.isMember;
    return input.post.communityVisibility === 'PUBLIC';
  }
  if (input.post.visibility === 'PUBLIC') return true;
  if (input.post.visibility === 'COLLEGE') {
    return Boolean(input.viewer?.collegeId && input.viewer.collegeId === input.post.collegeId);
  }
  return false;
}

export function canModerateContent(
  actor: AuthUser,
  content: { collegeId: string | null; communityId: string | null },
  moderatorOf: string[],
) {
  if (actor.role === 'PLATFORM_ADMIN') return true;
  if (actor.role === 'COLLEGE_ADMIN' && content.collegeId && actor.collegeId === content.collegeId) return true;
  return Boolean(content.communityId && moderatorOf.includes(content.communityId));
}

export function canDeleteContent(
  actor: AuthUser,
  content: { authorId: string; collegeId: string | null; communityId: string | null },
  moderatorOf: string[],
) {
  return actor.id === content.authorId || canModerateContent(actor, content, moderatorOf);
}

export function canViewProfile(input: {
  viewer: Pick<AuthUser, 'id' | 'collegeId'> | null;
  profile: { userId: string; visibility: 'PUBLIC' | 'COLLEGE' | 'PRIVATE'; collegeId: string | null; deleted: boolean };
  blocked: boolean;
}) {
  if (input.profile.deleted || input.blocked) return false;
  if (input.viewer?.id === input.profile.userId) return true;
  if (input.profile.visibility === 'PUBLIC') return true;
  if (input.profile.visibility === 'COLLEGE') {
    return Boolean(input.viewer?.collegeId && input.viewer.collegeId === input.profile.collegeId);
  }
  return false;
}
