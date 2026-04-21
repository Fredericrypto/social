import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  TextInput, StatusBar, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth.store";

const C = {
  bg:      "#0D1018",
  surface: "rgba(255,255,255,0.05)",
  border:  "rgba(255,255,255,0.08)",
  text:    "#F1F5F9",
  textSec: "rgba(241,245,249,0.45)",
  primary: "#64748B",
  btnBg:   "#F1F5F9",
  btnText: "#0D1018",
};

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogin = useCallback(async () => {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      await login(trimEmail, password);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg    = e?.response?.data?.message;
      if (status === 401 || status === 404) {
        Alert.alert("Credenciais inválidas", "Email ou senha incorretos");
      } else if (!status) {
        Alert.alert("Sem conexão", "Verifique sua internet e tente novamente");
      } else {
        Alert.alert("Erro", msg || "Tente novamente");
      }
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  return (
    <View style={[s.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Conteúdo scrollável */}
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={s.heading}>
            <Text style={s.title}>{`Let's sign\nyou in.`}</Text>
            <Text style={s.sub}>{`Welcome back.\nYou've been missed!`}</Text>
          </View>

          <View style={s.form}>
            <View style={s.field}>
              <TextInput
                style={s.input}
                placeholder="Phone, email or username"
                placeholderTextColor={C.textSec}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                textContentType="emailAddress"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={s.field}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={C.textSec}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                textContentType="password"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={C.textSec} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Footer dentro do KAV — sobe com teclado */}
        <View style={s.footer}>
          <Text style={s.noAccount}>
            {`Don't have an account? `}
            <Text style={s.registerLink} onPress={() => navigation.navigate("Register")}>
              Register
            </Text>
          </Text>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.btnText} />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, paddingHorizontal: 28, paddingTop: 100, paddingBottom: 16 },
  heading:      { marginBottom: 48 },
  title:        { fontSize: 40, fontWeight: "800", color: C.text, letterSpacing: -1, lineHeight: 48, marginBottom: 14 },
  sub:          { fontSize: 16, color: C.textSec, lineHeight: 24 },
  form:         { gap: 12 },
  field:        { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 18, height: 56 },
  input:        { flex: 1, fontSize: 15, color: C.text, height: "100%" as any },
  footer:       { paddingHorizontal: 28, paddingVertical: 16, gap: 14 },
  noAccount:    { textAlign: "center", fontSize: 14, color: C.textSec },
  registerLink: { color: C.text, fontWeight: "700" },
  btn:          { backgroundColor: C.btnBg, borderRadius: 50, height: 56, alignItems: "center", justifyContent: "center" },
  btnText:      { color: C.btnText, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
});
