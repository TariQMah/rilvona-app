import { type ComponentType } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { Text } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../api/session';
import { RealtimeLmsBanner } from '../components/RealtimeLmsBanner';
import { BrandLogo } from '../components/ui';
import { AcademicsScreen } from '../screens/academics/AcademicsScreen';
import { CommunitiesScreen } from '../screens/communities/CommunityScreens';
import { CreateHubScreen } from '../screens/create/CreateScreens';
import {
  SearchScreen,
  NotificationsScreen,
} from '../screens/discover/DiscoverScreens';
import { EventsScreen } from '../screens/events/CampusScreens';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreens';
import { WelcomeScreen } from '../screens/auth/AuthScreens';
import { CommunityDetailScreen } from '../screens/communities/CommunityScreens';
import {
  CreateEventScreen,
  EventDetailScreen,
  QuestionDetailScreen,
  QuestionsScreen,
  AskQuestionScreen,
} from '../screens/events/CampusScreens';
import { CreatePostScreen } from '../screens/create/CreateScreens';
import { ModerationScreen } from '../screens/moderation/ModerationScreen';
import { PostDetailScreen } from '../screens/posts/PostDetailScreen';
import {
  BlocksScreen,
  BookmarksScreen,
  EditProfileScreen,
  PublicProfileScreen,
  SettingsScreen,
  VerificationScreen,
} from '../screens/profile/ProfileScreens';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function withTopInset<P extends object>(Screen: ComponentType<P>) {
  return function InsetScreen(props: P) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    return (
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          backgroundColor: colors.background,
        }}
      >
        <Screen {...props} />
      </View>
    );
  };
}

const SafeHome = withTopInset(HomeScreen);
const SafeCommunities = withTopInset(CommunitiesScreen);
const SafeCreate = withTopInset(CreateHubScreen);
const SafeEvents = withTopInset(EventsScreen);
const SafeProfile = withTopInset(ProfileScreen);

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
      }}
    >
      <Tabs.Screen name="Home" component={SafeHome} />
      <Tabs.Screen
        name="Communities"
        component={SafeCommunities}
        options={{ title: 'Hives' }}
      />
      <Tabs.Screen name="Create" component={SafeCreate} />
      <Tabs.Screen name="Events" component={SafeEvents} />
      <Tabs.Screen
        name="Profile"
        component={SafeProfile}
        options={{ title: 'You' }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const hydrated = useSession(state => state.hydrated);
  const user = useSession(state => state.user);
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.accent,
    },
  };

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <BrandLogo size={96} />
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
          Rilvona
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef} theme={navigationTheme}>
      {user ? (
        <RealtimeLmsBanner
          onOpenLms={() => {
            if (navRef.isReady()) {
              navRef.navigate('Academics');
            }
          }}
        />
      ) : null}
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {user ? (
          <>
            {/* CUIMS is the default screen: the first screen of the signed-in stack is the one shown. */}
            <Stack.Screen
              name="Academics"
              component={AcademicsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ title: 'Post' }}
            />
            <Stack.Screen
              name="CommunityDetail"
              component={CommunityDetailScreen}
              options={{ title: 'Hive' }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetailScreen}
              options={{ title: 'Event' }}
            />
            <Stack.Screen name="Questions" component={QuestionsScreen} />
            <Stack.Screen
              name="QuestionDetail"
              component={QuestionDetailScreen}
              options={{ title: 'Question' }}
            />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Alerts' }}
            />
            <Stack.Screen
              name="CreatePost"
              component={CreatePostScreen}
              options={{ title: 'New post' }}
            />
            <Stack.Screen
              name="AskQuestion"
              component={AskQuestionScreen}
              options={{ title: 'Ask' }}
            />
            <Stack.Screen
              name="CreateEvent"
              component={CreateEventScreen}
              options={{ title: 'New event' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: 'Edit profile' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{ title: 'Verification' }}
            />
            <Stack.Screen
              name="Blocks"
              component={BlocksScreen}
              options={{ title: 'Blocked' }}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={{ title: 'Saved' }}
            />
            <Stack.Screen name="Moderation" component={ModerationScreen} />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{ title: 'Student' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
