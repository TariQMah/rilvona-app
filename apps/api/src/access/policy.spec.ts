import { canDeleteContent, canModerateContent, canViewPost, canViewProfile } from './policy';

const viewer = { id: 'viewer', collegeId: 'college-a', role: 'STUDENT' as const, status: 'ACTIVE' as const, emailVerified: true };

describe('visibility policy', () => {
  const base = {
    authorId: 'author',
    visibility: 'PUBLIC' as const,
    collegeId: 'college-a',
    communityId: null,
    communityVisibility: null,
    deletedAt: null,
  };

  it('hides deleted, blocked, and other-college posts', () => {
    expect(canViewPost({ viewer, post: { ...base, deletedAt: new Date() }, blocked: false, isMember: false })).toBe(false);
    expect(canViewPost({ viewer, post: base, blocked: true, isMember: false })).toBe(false);
    expect(
      canViewPost({
        viewer,
        post: { ...base, visibility: 'COLLEGE', collegeId: 'college-b' },
        blocked: false,
        isMember: false,
      }),
    ).toBe(false);
  });

  it('requires membership for restricted communities even if the client marks a post public', () => {
    expect(
      canViewPost({
        viewer,
        post: { ...base, visibility: 'PUBLIC', communityId: 'secret', communityVisibility: 'RESTRICTED' },
        blocked: false,
        isMember: false,
      }),
    ).toBe(false);
    expect(
      canViewPost({
        viewer,
        post: { ...base, communityId: 'secret', communityVisibility: 'RESTRICTED' },
        blocked: false,
        isMember: true,
      }),
    ).toBe(true);
  });

  it('lets community moderators remove community content and not unrelated posts', () => {
    expect(canModerateContent(viewer, { collegeId: 'college-a', communityId: 'club' }, ['club'])).toBe(true);
    expect(canModerateContent(viewer, { collegeId: 'college-a', communityId: 'other' }, ['club'])).toBe(false);
    expect(canDeleteContent(viewer, { authorId: 'viewer', collegeId: null, communityId: null }, [])).toBe(true);
  });

  it('keeps private profiles and blocked people out of public views', () => {
    expect(
      canViewProfile({
        viewer,
        profile: { userId: 'other', visibility: 'PRIVATE', collegeId: 'college-a', deleted: false },
        blocked: false,
      }),
    ).toBe(false);
    expect(
      canViewProfile({
        viewer,
        profile: { userId: 'other', visibility: 'PUBLIC', collegeId: 'college-a', deleted: false },
        blocked: true,
      }),
    ).toBe(false);
  });
});
