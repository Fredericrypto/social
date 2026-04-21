import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  TextInput, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth.store";
import TermsModal from "../../components/modals/TermsModal";

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

function Field({ placeholder, value, onChangeText, secureTextEntry,
  keyboardType, autoCapitalize, returnKeyType, onSubmitEditing,
  inputRef, textContentType, showToggle, onToggle, showPass }: any) {
  return (
    <View style={f.wrap}>
      <TextInput
        ref={inputRef}
        style={[f.input, showToggle && { flex: 1 }]}
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
          <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={C.textSec} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const f = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 18, height: 56 },
  input: { flex: 1, fontSize: 15, color: C.text, height: "100%" as any },
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
  const insets = useSafeAreaInsets();

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
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={s.heading}>
            <Text style={s.title}>{`Create\naccount.`}</Text>
            <Text style={s.sub}>Free. Fast. No spam.</Text>
          </View>

          <View style={s.form}>
            <Field placeholder="Display name (optional)" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} textContentType="name" />
            <Field placeholder="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" returnKeyType="next" inputRef={emailRef} onSubmitEditing={() => usernameRef.current?.focus()} textContentType="emailAddress" />
            <Field placeholder="Username *" value={username} onChangeText={setUsername} returnKeyType="next" inputRef={usernameRef} onSubmitEditing={() => passwordRef.current?.focus()} textContentType="username" />
            <Field placeholder="Password * (min. 8 chars)" value={password} onChangeText={setPassword} secureTextEntry showToggle showPass={showPass} onToggle={() => setShowPass(v => !v)} returnKeyType="done" inputRef={passwordRef} onSubmitEditing={handleRegister} textContentType="newPassword" />

            <TouchableOpacity style={s.termsRow} onPress={() => setTermsVisible(true)} activeOpacity={0.7}>
              <View style={[s.checkbox, termsAccepted && { backgroundColor: C.primary, borderColor: C.primary }]}>
                {termsAccepted && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              <Text style={s.termsText}>
                {`I've read and agree to the `}
                <Text style={{ color: C.text, fontWeight: "600" }}>Terms of Use</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer dentro do KAV — sobe com teclado */}
        <View style={s.footer}>
          <Text style={s.hasAccount}>
            {`Already have an account? `}
            <Text style={s.loginLink} onPress={() => navigation.goBack()}>Sign In</Text>
          </Text>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.btnText} />
              : <Text style={s.btnText}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <TermsModal
        visible={termsVisible}
        onAccept={() => { setTermsAccepted(true); setTermsVisible(false); }}
        onDecline={() => setTermsVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  scroll:     { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 16 },
  back:       { marginBottom: 24, width: 36 },
  heading:    { marginBottom: 40 },
  title:      { fontSize: 40, fontWeight: "800", color: C.text, letterSpacing: -1, lineHeight: 48, marginBottom: 10 },
  sub:        { fontSize: 16, color: C.textSec },
  form:       { gap: 12 },
  termsRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  checkbox:   { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  termsText:  { flex: 1, fontSize: 12, lineHeight: 18, color: C.textSec },
  footer:     { paddingHorizontal: 28, paddingVertical: 16, gap: 14 },
  hasAccount: { textAlign: "center", fontSize: 14, color: C.textSec },
  loginLink:  { color: C.text, fontWeight: "700" },
  btn:        { backgroundColor: C.btnBg, borderRadius: 50, height: 56, alignItems: "center", justifyContent: "center" },
  btnText:    { color: C.btnText, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
});
