import "react-native-gesture-handler";
import React, { useLayoutEffect } from "react";
import { View, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import Navigation from "./src/navigation";
import { useThemeStore } from "./src/store/theme.store";

function ThemedRoot() {
  const { theme, isDark } = useThemeStore();

  useLayoutEffect(() => {
    if (Platform.OS === "android") {
      // Força a barra a ser totalmente transparente e absoluta
      const prepareNav = async () => {
        await NavigationBar.setPositionAsync("absolute");
        await NavigationBar.setBackgroundColorAsync("#ffffff00"); // Transparente
        await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
      };
      prepareNav();
    }
  }, [isDark]); // Re-executa se o tema mudar

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Navigation />
    </View>
  );
}

export default function App() {
  return <ThemedRoot />;
}