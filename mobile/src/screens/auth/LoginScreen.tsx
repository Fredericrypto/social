import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, Dimensions, StatusBar,
  ScrollView, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import PrimaryButton from "../../components/ui/PrimaryButton";

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const { theme } = useThemeStore();

  const handleLogin = useCallback(async () => {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }
    setLoading(true);
    console.log("[Login] Tentando:", trimEmail);
    try {
      await login(trimEmail, password);
      console.log("[Login] Sucesso");
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      console.error("[Login] Erro:", status, msg || e?.message);

      if (status === 401 || status === 404) {
        Alert.alert("Credenciais inválidas", "Email ou senha incorretos");
      } else if (!status) {
        Alert.alert("Sem conexão", "Verifique se o servidor está rodando e tente novamente");
      } else {
        Alert.alert("Erro", msg || "Tente novamente");
      }
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#1a0533", "#0f1a3a", theme.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.6 }}
      />
      <View style={styles.glow} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <LinearGradient
              colors={["#7C3AED", "#6D28D9"]}
              style={styles.logoBox}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logoGlyph}>◈</Text>
            </LinearGradient>
            <Text style={[styles.appName, { color: theme.text }]}>Rede</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              Conecte-se com quem importa
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.fieldIcon}>✉</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                textContentType="emailAddress"
                underlineColorAndroid="transparent"
                blurOnSubmit={false}
              />
            </View>

            <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={styles.fieldIcon}>🔒</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                placeholder="Senha"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                textContentType="password"
                underlineColorAndroid="transparent"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={() => setShowPass(v => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.toggle, { color: theme.textSecondary }]}>
                  {showPass ? "OCULTAR" : "MOSTRAR"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={[styles.forgot, { color: theme.primaryLight }]}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            <PrimaryButton label="Entrar" onPress={handleLogin} loading={loading} />

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
              <Text style={[styles.orText, { color: theme.textSecondary }]}>ou</Text>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.registerRow}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Não tem conta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={{ color: theme.primaryLight, fontSize: 14, fontWeight: "700" }}>Criar agora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#7C3AED", opacity: 0.06, top: -80, alignSelf: "center" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 60 },
  logoArea: { alignItems: "center", marginBottom: 48, gap: 10 },
  logoBox: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  logoGlyph: { fontSize: 34, color: "#fff" },
  appName: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { fontSize: 14 },
  form: { gap: 12 },
  field: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 54 },
  fieldIcon: { fontSize: 16, marginRight: 10, opacity: 0.5 },
  fieldInput: { flex: 1, fontSize: 15, height: "100%" as any },
  toggle: { fontSize: 11, fontWeight: "600" },
  forgotRow: { alignItems: "flex-end", marginTop: -4 },
  forgot: { fontSize: 12, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1 },
  orText: { fontSize: 12 },
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 },
});
