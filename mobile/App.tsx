import "react-native-gesture-handler";
import React from "react";
import { View } from "react-native";
import Navigation from "./src/navigation";
import { useThemeStore } from "./src/store/theme.store";

// Wrapper que garante fundo correto desde o primeiro frame
function ThemedRoot() {
  const { theme } = useThemeStore();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Navigation />
    </View>
  );
}

export default function App() {
  return <ThemedRoot />;
}
