import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import PrimaryButton from '../../components/ui/PrimaryButton';
import Input from '../../components/ui/Input';

export default function RegisterScreen({ navigation }: any) {
  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const { theme } = useThemeStore();
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.email || !form.username || !form.password)
      return Alert.alert('Campos obrigatórios', 'Preencha email, username e senha');
    if (form.password.length < 8)
      return Alert.alert('Senha fraca', 'Mínimo de 8 caracteres');
    if (!/^[a-zA-Z0-9_]+$/.test(form.username))
      return Alert.alert('Username inválido', 'Use apenas letras, números e _');
    setLoading(true);
    try {
      await register(form.email.trim().toLowerCase(), form.username.trim(), form.password, form.displayName || undefined);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#1a0533', '#0f1a3a', theme.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 0.5 }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.logoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize: 30, color: '#fff' }}>◈</Text>
            </LinearGradient>
            <Text style={[styles.title, { color: theme.text }]}>Criar conta</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>Rápido, gratuito e sem spam</Text>
          </View>

          <View style={styles.form}>
            <Input icon="👤" placeholder="Nome de exibição (opcional)" value={form.displayName} onChangeText={set('displayName')} autoCapitalize="words" />
            <Input icon="✉" placeholder="Email *" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Input icon="@" placeholder="Username * (ex: frederic)" value={form.username} onChangeText={set('username')} autoCapitalize="none" autoCorrect={false} />
            <Input icon="🔒" placeholder="Senha * (mín. 8 caracteres)" value={form.password} onChangeText={set('password')} secureTextEntry />

            <Text style={[styles.terms, { color: theme.textSecondary }]}>
              Ao criar uma conta você concorda com os{' '}
              <Text style={{ color: theme.primaryLight }}>Termos de uso</Text>
            </Text>

            <PrimaryButton label="Criar conta" onPress={handleRegister} loading={loading} />

            <View style={styles.loginRow}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={{ color: theme.primaryLight, fontSize: 14, fontWeight: '700' }}>Entrar</Text>
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
  header: { alignItems: 'center', marginBottom: 40, gap: 10 },
  logoBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 14 },
  form: { gap: 12 },
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
});
