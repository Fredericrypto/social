import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";
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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function BadgeDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

function NewPostButton() {
  return (
    <LinearGradient
      colors={["#7C3AED", "#6D28D9"]}
      style={styles.newPostBtn}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Ionicons name="add" size={24} color="#fff" />
    </LinearGradient>
  );
}

function MainTabs() {
  const { theme, isDark } = useThemeStore();
  const { unreadNotifications } = useBadges();

  const tabBarBg = isDark ? "#0D0D14" : "#FFFFFF";
  const tabBarBorder = isDark ? "#1F1F2E" : "#EFEFEF";
  const activeColor = theme.primary;
  const inactiveColor = isDark ? "#4B5563" : "#9CA3AF";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 82 : 62,
          paddingBottom: Platform.OS === "ios" ? 22 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarIcon: ({ focused, color }) => {
          if (route.name === "NewPost") {
            return <NewPostButton />;
          }
          const iconMap: Record<string, [string, string]> = {
            Feed:          ["home",          "home-outline"],
            Explore:       ["search",        "search-outline"],
            Notifications: ["notifications", "notifications-outline"],
            Profile:       ["person",        "person-outline"],
          };
          const [active, inactive] = iconMap[route.name] || ["apps", "apps-outline"];
          return (
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={(focused ? active : inactive) as any}
                size={24}
                color={focused ? activeColor : inactiveColor}
              />
              {route.name === "Notifications" && (
                <BadgeDot count={unreadNotifications} />
              )}
              {focused && (
                <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
              )}
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
    </Stack.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { theme, isDark } = useThemeStore();

  useEffect(() => { loadUser(); }, []);

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.background, card: theme.surface } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.background, card: theme.surface } };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.loadingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
    <BadgeProvider>
      <AppContent />
    </BadgeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  newPostBtn: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  tabIconWrap: { alignItems: "center", gap: 3 },
  activeDot: { width: 4, height: 4, borderRadius: 2 },
  badge: {
    position: "absolute", top: -5, right: -10,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
