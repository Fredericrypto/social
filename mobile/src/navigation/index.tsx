import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
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
    <LinearGradient
      colors={["#7C3AED", "#6D28D9"]}
      style={s.newPostBtn}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <Ionicons name="add" size={24} color="#fff" />
    </LinearGradient>
  );
}

// Tab bar customizada com BlurView
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { isDark } = useThemeStore();
  const { unreadNotifications } = useBadges();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.tabBarOuter, { paddingBottom: insets.bottom, height: 56 + insets.bottom }]}>
      <BlurView
        intensity={80}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Linha superior sutil */}
      <View style={[s.tabBarLine, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]} />

      <View style={s.tabBarInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (route.name === "NewPost") {
            return (
              <View key={route.key} style={s.tabItem}>
                <NewPostButton />
              </View>
            );
          }

          const icons: Record<string, [string, string]> = {
            Feed:          ["home",          "home-outline"         ],
            Explore:       ["search",        "search-outline"       ],
            Notifications: ["notifications", "notifications-outline"],
            Profile:       ["person",        "person-outline"       ],
          };
          const [activeIcon, inactiveIcon] = icons[route.name] || ["apps", "apps-outline"];
          const iconColor = focused
            ? "#7C3AED"
            : isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

          return (
            <View key={route.key} style={s.tabItem}>
              <View
                style={[
                  s.tabIconWrap,
                  focused && s.tabIconWrapActive,
                ]}
              >
                <Ionicons
                  name={(focused ? activeIcon : inactiveIcon) as any}
                  size={22}
                  color={iconColor}
                />
                {route.name === "Notifications" && <BadgeDot count={unreadNotifications} />}
              </View>
              {focused && <View style={s.tabActiveDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Feed"          component={FeedScreen}          />
      <Tab.Screen name="Explore"       component={ExploreScreen}       />
      <Tab.Screen name="NewPost"       component={NewPostScreen}       />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileScreen}       />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="Tabs"        component={MainTabs}           />
      <Stack.Screen name="Chat"        component={ChatScreen}         options={{ gestureEnabled: true }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen}  options={{ gestureEnabled: true }} />
      <Stack.Screen name="Messages"    component={MessagesScreen}     options={{ gestureEnabled: true }} />
      <Stack.Screen name="Settings"    component={SettingsScreen}     options={{ gestureEnabled: true }} />
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
      primary:      theme.primary,
      background:   theme.background,
      card:         isDark ? "#0D0D14" : "#FFFFFF",
      text:         theme.text,
      border:       theme.border,
      notification: "#EF4444",
    },
  };

  if (isLoading) {
    return (
      <View style={[s.loading, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={["#7C3AED", "#6D28D9"]}
          style={s.loadingIcon}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
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
            <Stack.Screen name="Login"    component={LoginScreen}    />
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
  loading:      { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingIcon:  { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  newPostBtn:   { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badge:        { position: "absolute", top: -5, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:    { color: "#fff", fontSize: 9, fontWeight: "700" },
  // Custom tab bar
  tabBarOuter:  { position: "absolute", bottom: 0, left: 0, right: 0, overflow: "hidden" },
  tabBarLine:   { height: 0.5, width: "100%" },
  tabBarInner:  { flex: 1, flexDirection: "row", alignItems: "center", paddingTop: 4 },
  tabItem:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabIconWrap:  { width: 44, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabIconWrapActive: { backgroundColor: "rgba(124,58,237,0.15)" },
  tabActiveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#7C3AED" },
});
