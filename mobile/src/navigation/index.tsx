import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import { BadgeProvider, useBadges } from "../context/BadgeContext";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import FeedScreen from "../screens/main/FeedScreen";
import ProfileScreen from "../screens/main/ProfileScreen";
import NewPostScreen from "../screens/main/NewPostScreen";
import MessagesScreen from "../screens/main/MessagesScreen";
import ChatScreen from "../screens/main/ChatScreen";
import EditProfileScreen from "../screens/main/EditProfileScreen";
import ExploreScreen from "../screens/main/ExploreScreen";
import NotificationsScreen from "../screens/main/NotificationsScreen";
import SettingsScreen from "../screens/main/SettingsScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function BadgeDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

function NewPostButton() {
  return (
    <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={s.newPostBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Ionicons name="add" size={24} color="#fff" />
    </LinearGradient>
  );
}

function MainTabs() {
  const { theme, isDark } = useThemeStore();
  const { unreadNotifications } = useBadges();
  const insets = useSafeAreaInsets();

  const bg = isDark ? "#0D0D14" : "#FFFFFF";
  const border = isDark ? "#1F1F2E" : "#EFEFEF";
  const active = theme.primary;
  const inactive = isDark ? "#4B5563" : "#374151";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: 0.5,
          // Safe area: adiciona padding do sistema + espaço visual
          height: 50 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarIcon: ({ focused, color }) => {
          if (route.name === "NewPost") return <NewPostButton />;

          const icons: Record<string, [string, string]> = {
            Feed:          ["home",          "home-outline"],
            Explore:       ["search",        "search-outline"],
            Notifications: ["notifications", "notifications-outline"],
            Profile:       ["person",        "person-outline"],
          };
          const [a, i] = icons[route.name] || ["apps", "apps-outline"];
          return (
            <View style={s.iconWrap}>
              <Ionicons name={(focused ? a : i) as any} size={24} color={focused ? active : inactive} />
              {route.name === "Notifications" && <BadgeDot count={unreadNotifications} />}
              {focused && <View style={[s.dot, { backgroundColor: active }]} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="NewPost" component={NewPostScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ gestureEnabled: true }} />
    </Stack.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { theme, isDark } = useThemeStore();

  useEffect(() => { loadUser(); }, []);

  const navTheme = {
    dark: isDark,
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: isDark ? "#0D0D14" : "#FFFFFF",
      text: theme.text,
      border: theme.border,
      notification: "#EF4444",
    },
  };

  if (isLoading) {
    return (
      <View style={[s.loading, { backgroundColor: theme.background }]}>
        <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={s.loadingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={{ fontSize: 28, color: "#fff" }}>◈</Text>
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

export default function Navigation() {
  return (
    <SafeAreaProvider>
      <BadgeProvider>
        <AppContent />
      </BadgeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  newPostBtn: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  iconWrap: { alignItems: "center", gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  badge: { position: "absolute", top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
