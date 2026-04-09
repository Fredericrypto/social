import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, Dimensions, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import PrimaryButton from '../../components/ui/PrimaryButton';
import Input from '../../components/ui/Input';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const { theme } = useThemeStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Preencha todos os campos');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert('Erro ao entrar', e?.response?.data?.message || 'Verifique suas credenciais');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#1a0533', '#0f1a3a', theme.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.6 }}
      />

      {/* Glow orb */}
      <View style={styles.glowOrb} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <LinearGradient
              colors={['#7C3AED', '#6D28D9']}
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
            <Input
              icon="✉"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              icon="🔒"
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              rightLabel={showPass ? 'OCULTAR' : 'MOSTRAR'}
              onRightPress={() => setShowPass(!showPass)}
            />

            <View style={styles.forgotRow}>
              <TouchableOpacity>
                <Text style={[styles.forgot, { color: theme.primaryLight }]}>
                  Esqueceu a senha?
                </Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton label="Entrar" onPress={handleLogin} loading={loading} />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
              <Text style={[styles.orText, { color: theme.textSecondary }]}>ou</Text>
              <View style={[styles.line, { backgroundColor: theme.border }]} />
            </View>

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: theme.textSecondary }]}>
                Não tem conta?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, { color: theme.primaryLight }]}>
                  Criar agora
                </Text>
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
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60 },
  glowOrb: {
    position: 'absolute', width: 300, height: 300,
    borderRadius: 150, backgroundColor: '#7C3AED',
    opacity: 0.08, top: -80, alignSelf: 'center',
    // blur simulado via opacidade em camadas
  },
  logoArea: { alignItems: 'center', marginBottom: 48, gap: 10 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C3AED', shadowOpacity: 0.5,
    shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  logoGlyph: { fontSize: 34, color: '#fff' },
  appName: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14 },
  form: { gap: 12 },
  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgot: { fontSize: 12, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1 },
  orText: { fontSize: 12 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: '700' },
});
