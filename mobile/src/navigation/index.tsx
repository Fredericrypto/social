import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import FeedScreen from '../screens/main/FeedScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import NewPostScreen from '../screens/main/NewPostScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import ChatScreen from '../screens/main/ChatScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import ExploreScreen from '../screens/main/ExploreScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function NewPostIcon({ focused }: { focused: boolean }) {
  return (
    <LinearGradient
      colors={focused ? ['#7C3AED', '#6D28D9'] : ['#1C1C27', '#1C1C27']}
      style={styles.newPostBtn}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <Ionicons name="add" size={22} color="#fff" />
    </LinearGradient>
  );
}

function MainTabs() {
  const { theme } = useThemeStore();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused, color }) => {
          if (route.name === 'NewPost') return <NewPostIcon focused={focused} />;
          const icons: Record<string, [string, string]> = {
            Feed:          ['home',               'home-outline'],
            Explore:       ['search',             'search-outline'],
            Notifications: ['notifications',      'notifications-outline'],
            Messages:      ['chatbubble',         'chatbubble-outline'],
            Profile:       ['person',             'person-outline'],
          };
          const [active, inactive] = icons[route.name] || ['apps', 'apps-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={23} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="NewPost" component={NewPostScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ gestureEnabled: true }} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => { loadUser(); }, []);

  const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.background } };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.loadingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={{ fontSize: 28, color: '#fff' }}>◈</Text>
        </LinearGradient>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  newPostBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
