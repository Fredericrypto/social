import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
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

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const { isDark } = useThemeStore();
  const { unreadNotifications } = useBadges();
  const insets = useSafeAreaInsets();

  const blurBg = isDark ? "rgba(10,10,15,0.75)" : "rgba(255,255,255,0.75)";
  const activeColor = "#7C3AED";
  const inactiveColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";

  const ICONS: Record<string, [string, string]> = {
    Feed:          ["home",          "home-outline"         ],
    Explore:       ["search",        "search-outline"       ],
    Notifications: ["notifications", "notifications-outline"],
    Profile:       ["person",        "person-outline"       ],
  };

  return (
    <View style={[s.floatingBar, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      {/* Glass background */}
      <View style={[s.barBackground, { backgroundColor: blurBg }]}>
        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
      </View>

      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        // Botão central NewPost
        if (route.name === "NewPost") {
          return (
            <TouchableOpacity key={route.key} style={s.newPostWrap} onPress={onPress} activeOpacity={0.85}>
              <LinearGradient
                colors={["#7C3AED", "#6D28D9"]}
                style={s.newPostBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add" size={26} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          );
        }

        const [activeIcon, inactiveIcon] = ICONS[route.name] || ["apps", "apps-outline"];
        const iconColor = focused ? activeColor : inactiveColor;

        return (
          <TouchableOpacity
            key={route.key}
            style={s.tabBtn}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, focused && s.iconWrapActive]}>
              <Ionicons name={(focused ? activeIcon : inactiveIcon) as any} size={22} color={iconColor} />
              {route.name === "Notifications" && unreadNotifications > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
                </View>
              )}
            </View>
            {focused && <View style={s.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
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
      <Stack.Screen name="Tabs"        component={MainTabs}          />
      <Stack.Screen name="Chat"        component={ChatScreen}        options={{ gestureEnabled: true }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="Messages"    component={MessagesScreen}    options={{ gestureEnabled: true }} />
      <Stack.Screen name="Settings"    component={SettingsScreen}    options={{ gestureEnabled: true }} />
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
      border:       "transparent",
      notification: "#EF4444",
    },
  };

  if (isLoading) {
    return (
      <View style={[{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }]}>
        <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={{ width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
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
  floatingBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 999,
  },
  barBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: "hidden",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 3,
  },
  iconWrap: {
    width: 44,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7C3AED",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  newPostWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    marginTop: -20,
  },
  newPostBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
