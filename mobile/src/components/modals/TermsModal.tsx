import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";

const { height } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function TermsModal({ visible, onAccept, onDecline }: Props) {
  const { theme } = useThemeStore();
  const [accepted, setAccepted] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Termos de Uso</Text>
            <TouchableOpacity onPress={onDecline} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

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

          <View style={[styles.checkRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.checkLeft} onPress={() => setAccepted(!accepted)} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: accepted ? theme.primary : theme.border }, accepted && { backgroundColor: theme.primary }]}>
                {accepted && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.checkText, { color: theme.textSecondary }]}>
                Li e aceito os Termos de Uso e a Política de Privacidade
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => { if (accepted) onAccept(); }} disabled={!accepted} activeOpacity={0.85}>
              <LinearGradient
                colors={accepted ? ["#7C3AED", "#6D28D9"] : [theme.surfaceHigh, theme.surfaceHigh]}
                style={styles.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.acceptText, { color: accepted ? "#fff" : theme.textSecondary }]}>Continuar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, maxHeight: height * 0.85 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, maxHeight: height * 0.5 },
  section: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 16 },
  body: { fontSize: 13, lineHeight: 20 },
  checkRow: { padding: 16, borderTopWidth: 1 },
  checkLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { padding: 16, paddingTop: 8 },
  acceptBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  acceptText: { fontSize: 15, fontWeight: "700" },
});
