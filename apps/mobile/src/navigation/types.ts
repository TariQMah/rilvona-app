export type RootStackParamList = {
  Welcome: undefined;
  Main: undefined;
  Academics: undefined;
  PostDetail: { postId: string };
  CommunityDetail: { slug: string };
  EventDetail: { eventId: string };
  Questions: undefined;
  QuestionDetail: { questionId: string };
  Search: undefined;
  Notifications: undefined;
  CreatePost: { communityId?: string; communityName?: string } | undefined;
  AskQuestion: { communityId?: string } | undefined;
  CreateEvent: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Verification: undefined;
  Blocks: undefined;
  Bookmarks: undefined;
  Moderation: undefined;
  PublicProfile: { username: string };
};

export type TabParamList = {
  Home: undefined;
  Communities: undefined;
  Create: undefined;
  Events: undefined;
  Profile: undefined;
};
