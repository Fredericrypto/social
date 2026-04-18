import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, Animated } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, DeviceEventEmitter } from "react-native";

// Event emitido quando usuário toca na aba já ativa → telas escutam para scroll to top + refresh
export const TAB_PRESS_EVENT = "TAB_PRESS_SCROLL_TOP";
import * as NavigationBar from "expo-navigation-bar";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import { presenceService } from "../services/presence.service";
import { BadgeProvider, useBadges } from "../context/BadgeContext";
import { socketService } from "../services/socket.service";
import { notificationsService } from "../services/notifications.service";

import LoginScreen         from "../screens/auth/LoginScreen";
import RegisterScreen      from "../screens/auth/RegisterScreen";
import FeedScreen          from "../screens/main/FeedScreen";
import ProfileScreen       from "../screens/main/ProfileScreen";
import NewPostScreen       from "../screens/main/NewPostScreen";
import MessagesScreen      from "../screens/main/MessagesScreen";
import ChatScreen          from "../screens/main/ChatScreen";
import EditProfileScreen   from "../screens/main/EditProfileScreen";
import ExploreScreen       from "../screens/main/ExploreScreen";
import NotificationsScreen from "../screens/main/NotificationsScreen";
import SettingsScreen      from "../screens/main/SettingsScreen";
import FollowersListScreen  from "../screens/main/FollowersListScreen";
import UserProfileScreen   from "../screens/main/UserProfileScreen";
import FlashEditorScreen   from "../screens/main/FlashEditorScreen";

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const ICONS: Record<string, [string, string]> = {
  Feed:          ["home",          "home-outline"         ],
  Explore:       ["search",        "search-outline"       ],
  Notifications: ["notifications", "notifications-outline"],
  Profile:       ["person",        "person-outline"       ],
};

function AnimatedTabIcon({ route, focused, color }: any) {
  const translateY = useRef(new Animated.Value(0)).current;
  const { unreadNotifications } = useBadges();

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.timing(translateY, { toValue: -5, duration: 110, useNativeDriver: true }),
        Animated.spring(translateY,  { toValue: 0,  useNativeDriver: true, friction: 5, tension: 180 }),
      ]).start();
    }
  }, [focused]);

  const [activeIcon, inactiveIcon] = ICONS[route.name] || ["apps", "apps-outline"];
  return (
    <Animated.View style={{ transform: [{ translateY }], alignItems: "center" }}>
      <Ionicons name={(focused ? activeIcon : inactiveIcon) as any} size={22} color={color} />
      {route.name === "Notifications" && unreadNotifications > 0 && (
        <View style={[s.badge, { backgroundColor: color }]}>
          <Text style={s.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function MainTabs() {
  const { isDark, theme } = useThemeStore();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.32)",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={88}
            tint={isDark ? "dark" : "light"}
            style={[StyleSheet.absoluteFillObject, {
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              overflow: "hidden",
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            }]}
          />
        ),
        tabBarIcon: ({ focused, color }) => {
          if (route.name === "NewPost") {
            return (
              <View style={s.newPostBtn}>
                <LinearGradient
                  colors={[theme.primary, theme.primaryLight]}
                  style={s.newPostGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </LinearGradient>
              </View>
            );
          }
          return <AnimatedTabIcon route={route} focused={focused} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            const state = navigation.getState();
            const activeRoute = state?.routes?.[state.index];
            if (activeRoute?.name === route.name) {
              DeviceEventEmitter.emit(TAB_PRESS_EVENT, route.name);
            }
          },
        })}
      />
      <Tab.Screen name="Explore"       component={ExploreScreen}       />
      <Tab.Screen name="NewPost"       component={NewPostScreen}       />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            const state = navigation.getState();
            const activeRoute = state?.routes?.[state.index];
            if (activeRoute?.name === route.name) {
              DeviceEventEmitter.emit(TAB_PRESS_EVENT, route.name);
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="Tabs"          component={MainTabs}            />
      <Stack.Screen name="Chat"          component={ChatScreen}          options={{ gestureEnabled: true }} />
      <Stack.Screen name="EditProfile"   component={EditProfileScreen}   options={{ gestureEnabled: true }} />
      <Stack.Screen name="Messages"      component={MessagesScreen}      options={{ gestureEnabled: true }} />
      <Stack.Screen name="Settings"      component={SettingsScreen}      options={{ gestureEnabled: true }} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="UserProfile"   component={UserProfileScreen}   options={{ gestureEnabled: true }} />
      <Stack.Screen name="FlashEditor"   component={FlashEditorScreen}   options={{ gestureEnabled: true, presentation: "fullScreenModal", headerShown: false, navigationBarHidden: true }} />
    </Stack.Navigator>
  );
}

// Auth Stack — cores FIXAS dark, nunca muda com o tema
function AuthStack() {
  const AUTH_THEME = {
    dark: true,
    colors: {
      primary: "#7C3AED", background: "#0A0A0F",
      card: "#0A0A0F", text: "#F0F0F5",
      border: "transparent", notification: "#EF4444",
    },
  };
  return (
    <NavigationContainer theme={AUTH_THEME}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login"    component={LoginScreen}    />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { theme, isDark } = useThemeStore();
  const navigationRef = useRef<any>(null);

  useEffect(() => { loadUser(); }, []);

  // ── Android Navigation Bar — sincroniza cor com o tema ─────────────────
  // Sem isso, a barra do sistema fica com cor errada no cold start
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setBackgroundColorAsync(theme.background).catch(() => {});
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark").catch(() => {});
  }, [theme.background, isDark]);

  // ── Presence: online ao autenticar, offline ao sair ────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      presenceService.goOnline();
    } else {
      presenceService.goOffline();
    }
  }, [isAuthenticated]);

  // ── Socket: conecta ao autenticar, desconecta ao sair ──────────────────
  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }
    return () => {};
  }, [isAuthenticated]);

  // ── Push Notifications: registra token ao autenticar ───────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    notificationsService.setNavigationRef(navigationRef);
    notificationsService.registerForPushNotifications();
    notificationsService.startListening();
    notificationsService.clearBadge();
    return () => {
      notificationsService.stopListening();
    };
  }, [isAuthenticated]);

  const appNavTheme = {
    dark: isDark,
    colors: {
      primary: theme.primary, background: theme.background,
      card: theme.surface, text: theme.text,
      border: "transparent", notification: "#EF4444",
    },
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0F" }}>
        <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={{ width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28, color: "#fff" }}>◈</Text>
        </LinearGradient>
        <ActivityIndicator color="#7C3AED" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!isAuthenticated) return <AuthStack />;

  return (
    <NavigationContainer theme={appNavTheme} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainStack} />
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
  badge:           { position: "absolute", top: -6, right: -8, minWidth: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:       { color: "#fff", fontSize: 9, fontWeight: "700" },
  newPostBtn:      { alignItems: "center", justifyContent: "center" },
  newPostGradient: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
