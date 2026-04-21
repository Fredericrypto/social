import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated, BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";

const { height } = Dimensions.get("window");
const SHEET_H = height * 0.85;

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * TermsModal sem usar <Modal> — evita o bug do Android que reseta
 * a navigation bar para branco ao abrir modais transparentes.
 * Renderiza diretamente como overlay absoluto na árvore de componentes.
 */
export default function TermsModal({ visible, onAccept, onDecline }: Props) {
  const { theme } = useThemeStore();
  const [accepted, setAccepted] = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const slideAnim  = useRef(new Animated.Value(SHEET_H)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setAccepted(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 220, mass: 0.8, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SHEET_H, duration: 240, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Botão voltar do Android
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onDecline();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDecline]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        pointerEvents="auto"
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onDecline} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderColor: theme.border },
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="auto"
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Termos de Uso</Text>
          <TouchableOpacity onPress={onDecline} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {[
            ["1. Coleta de Dados (LGPD/GDPR)", "Coletamos apenas dados necessários: nome, email e conteúdo publicado voluntariamente. Seus dados nunca são vendidos a terceiros."],
            ["2. Uso das Informações", "Dados utilizados exclusivamente para: autenticação, personalização da experiência e segurança da plataforma."],
            ["3. Seus Direitos", "Conforme a LGPD (Lei 13.709/2018) e GDPR, você pode acessar, corrigir e excluir seus dados a qualquer momento via configurações."],
            ["4. Conteúdo", "Você é responsável pelo conteúdo publicado. Proibido: conteúdo ilegal, discurso de ódio, spam ou violação de direitos de terceiros."],
            ["5. Segurança", "Utilizamos bcrypt para senhas e JWT com expiração para sessões. Suas credenciais nunca são compartilhadas."],
            ["6. Cookies", "Usamos apenas tokens de sessão essenciais. Sem cookies de rastreamento publicitário."],
            ["7. Contato", "Dúvidas sobre privacidade: privacidade@rede.app. Resposta em até 15 dias úteis (LGPD)."],
          ].map(([title, body]) => (
            <View key={title}>
              <Text style={[styles.section, { color: theme.primary }]}>{title}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Checkbox */}
        <View style={[styles.checkRow, { borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.checkLeft} onPress={() => setAccepted(v => !v)} activeOpacity={0.7}>
            <View style={[
              styles.checkbox,
              { borderColor: accepted ? theme.primary : theme.border },
              accepted && { backgroundColor: theme.primary },
            ]}>
              {accepted && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={[styles.checkText, { color: theme.textSecondary }]}>
              Li e aceito os Termos de Uso e a Política de Privacidade
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botão */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => { if (accepted) onAccept(); }}
            disabled={!accepted}
            activeOpacity={0.85}
            style={[
              styles.acceptBtn,
              { backgroundColor: accepted ? theme.text : theme.surfaceHigh },
            ]}
          >
            <Text style={[styles.acceptText, { color: accepted ? theme.background : theme.textSecondary }]}>
              Continuar
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:       {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
  },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content:     { padding: 20, maxHeight: height * 0.5 },
  section:     { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 16 },
  body:        { fontSize: 13, lineHeight: 20 },
  checkRow:    { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  checkLeft:   { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText:   { flex: 1, fontSize: 13, lineHeight: 18 },
  footer:      { padding: 16, paddingTop: 8 },
  acceptBtn:   { borderRadius: 50, height: 52, alignItems: "center", justifyContent: "center" },
  acceptText:  { fontSize: 15, fontWeight: "700" },
});
