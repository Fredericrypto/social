import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Switch,
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

  const handleAccept = () => {
    if (!accepted) return;
    onAccept();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Termos de Uso</Text>
            <TouchableOpacity onPress={onDecline} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Conteúdo */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: theme.primary }]}>1. Coleta de Dados (LGPD/GDPR)</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Coletamos apenas os dados necessários para o funcionamento do serviço: nome, email e conteúdo publicado voluntariamente. Seus dados nunca são vendidos a terceiros.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>2. Uso das Informações</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              As informações coletadas são utilizadas exclusivamente para: autenticação, personalização da experiência, comunicações sobre sua conta e segurança da plataforma.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>3. Seus Direitos</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Conforme a LGPD (Lei 13.709/2018) e o GDPR, você tem direito a: acessar, corrigir e excluir seus dados a qualquer momento. Solicite via configurações do perfil.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>4. Conteúdo</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Você é responsável pelo conteúdo publicado. É proibido: conteúdo ilegal, discurso de ódio, spam ou violação de direitos de terceiros.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>5. Segurança</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Utilizamos criptografia bcrypt para senhas e JWT com expiração para sessões. Nunca compartilhamos suas credenciais.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>6. Cookies e Rastreamento</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Usamos apenas tokens de sessão essenciais. Não utilizamos cookies de rastreamento publicitário.
            </Text>

            <Text style={[styles.section, { color: theme.primary }]}>7. Contato</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Para questões sobre privacidade: privacidade@rede.app. Respondemos em até 15 dias úteis conforme exigido pela LGPD.
            </Text>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Checkbox de aceite */}
          <View style={[styles.checkRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={styles.checkLeft}
              onPress={() => setAccepted(!accepted)}
              activeOpacity={0.7}
            >
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
              onPress={handleAccept}
              disabled={!accepted}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={accepted ? ["#7C3AED", "#6D28D9"] : [theme.surfaceHigh, theme.surfaceHigh]}
                style={styles.acceptBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.acceptText, { color: accepted ? "#fff" : theme.textSecondary }]}>
                  Continuar
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: height * 0.85,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, maxHeight: height * 0.55 },
  section: { fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 16 },
  body: { fontSize: 13, lineHeight: 20 },
  checkRow: {
    padding: 16,
    borderTopWidth: 1,
  },
  checkLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { padding: 16, paddingTop: 8 },
  acceptBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  acceptText: { fontSize: 15, fontWeight: "700" },
});
