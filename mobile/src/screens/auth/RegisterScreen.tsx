import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth.store";
import PrimaryButton from "../../components/ui/PrimaryButton";
import TermsModal from "../../components/modals/TermsModal";

// Cores FIXAS dark — register nunca muda com o tema do app
const C = {
  bg:          "#0A0A0F",
  surface:     "#13131A",
  border:      "rgba(255,255,255,0.07)",
  text:        "#F0F0F5",
  textSec:     "rgba(240,240,245,0.5)",
  primary:     "#7C3AED",
  primaryLight:"#A78BFA",
};

function Field({
  icon, placeholder, value, onChangeText,
  secureTextEntry, keyboardType, autoCapitalize,
  returnKeyType, onSubmitEditing, inputRef,
  textContentType, showToggle, onToggle, showPass,
}: any) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.icon}>{icon}</Text>
      <TextInput
        ref={inputRef}
        style={fieldStyles.input}
        placeholder={placeholder}
        placeholderTextColor={C.textSec}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPass}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "none"}
        autoCorrect={false}
        returnKeyType={returnKeyType || "next"}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={false}
        underlineColorAndroid="transparent"
        textContentType={textContentType}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSec} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, height: 54, backgroundColor: C.surface, borderColor: C.border },
  icon:  { fontSize: 16, marginRight: 10, opacity: 0.5 },
  input: { flex: 1, fontSize: 15, height: "100%" as any, color: C.text },
});

export default function RegisterScreen({ navigation }: any) {
  const [displayName,   setDisplayName]   = useState("");
  const [email,         setEmail]         = useState("");
  const [username,      setUsername]      = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [termsVisible,  setTermsVisible]  = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading,       setLoading]       = useState(false);

  const { register } = useAuthStore();

  const emailRef    = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleRegister = useCallback(async () => {
    const trimEmail    = email.trim().toLowerCase();
    const trimUsername = username.trim().toLowerCase();

    if (!trimEmail || !trimUsername || !password) {
      Alert.alert("Campos obrigatórios", "Preencha email, username e senha");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Senha fraca", "Mínimo de 8 caracteres");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimUsername)) {
      Alert.alert("Username inválido", "Apenas letras, números e _");
      return;
    }
    if (!termsAccepted) {
      setTermsVisible(true);
      return;
    }

    setLoading(true);
    try {
      await register(trimEmail, trimUsername, password, displayName.trim() || undefined);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      Alert.alert("Erro", Array.isArray(msg) ? msg.join("\n") : msg || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }, [email, username, password, displayName, termsAccepted]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={["#1a0533", "#0f1a3a", C.bg]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.5 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize: 30, color: "#fff" }}>◈</Text>
            </LinearGradient>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.sub}>Rápido, gratuito e sem spam</Text>
          </View>

          <View style={styles.form}>
            <Field icon="👤" placeholder="Nome de exibição (opcional)" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} textContentType="name" />
            <Field icon="✉" placeholder="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" returnKeyType="next" inputRef={emailRef} onSubmitEditing={() => usernameRef.current?.focus()} textContentType="emailAddress" />
            <Field icon="@" placeholder="Username *" value={username} onChangeText={setUsername} returnKeyType="next" inputRef={usernameRef} onSubmitEditing={() => passwordRef.current?.focus()} textContentType="username" />
            <Field icon="🔒" placeholder="Senha * (mín. 8 caracteres)" value={password} onChangeText={setPassword} secureTextEntry showToggle showPass={showPass} onToggle={() => setShowPass(v => !v)} returnKeyType="done" inputRef={passwordRef} onSubmitEditing={handleRegister} textContentType="newPassword" />

            <TouchableOpacity style={styles.termsRow} onPress={() => setTermsVisible(true)} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: termsAccepted ? C.primary : C.border }, termsAccepted && { backgroundColor: C.primary }]}>
                {termsAccepted && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                Li e aceito os{" "}
                <Text style={{ color: C.primaryLight, fontWeight: "600" }}>Termos de Uso</Text>
              </Text>
            </TouchableOpacity>

            <PrimaryButton label="Criar conta" onPress={handleRegister} loading={loading} />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsModal
        visible={termsVisible}
        onAccept={() => { setTermsAccepted(true); setTermsVisible(false); }}
        onDecline={() => setTermsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  scroll:    { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 60 },
  header:    { alignItems: "center", marginBottom: 32, gap: 10 },
  logo:      { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:     { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, color: C.text },
  sub:       { fontSize: 14, color: C.textSec },
  form:      { gap: 12 },
  termsRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  checkbox:  { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  termsText: { flex: 1, fontSize: 12, lineHeight: 18, color: C.textSec },
  loginRow:  { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  loginText: { color: C.textSec, fontSize: 14 },
  loginLink: { color: C.primaryLight, fontSize: 14, fontWeight: "700" },
});
