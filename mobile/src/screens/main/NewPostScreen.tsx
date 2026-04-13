import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { postsService } from "../../services/posts.service";
import Avatar from "../../components/ui/Avatar";

const { width } = Dimensions.get("window");

const LANGUAGES = ["javascript","typescript","python","java","kotlin","swift","go","rust","cpp","css","html","sql","bash"];

function detectLanguage(code: string): string {
  if (code.includes("import React") || code.includes("useState") || code.includes("=>")) return "typescript";
  if (code.includes("def ") || code.includes("print(") || code.includes("import os")) return "python";
  if (code.includes("fun ") && code.includes("val ")) return "kotlin";
  if (code.includes("func ") && code.includes(":=")) return "go";
  if (code.includes("SELECT") || code.includes("FROM ")) return "sql";
  if (code.includes("#!/bin/bash") || code.includes("echo ")) return "bash";
  if (code.includes("<div") || code.includes("</")) return "html";
  if (code.includes("{") && code.includes(":") && code.includes(";")) return "css";
  return "javascript";
}

type PostMode = "text" | "image" | "code";

export default function NewPostScreen({ navigation }: any) {
  const [mode, setMode] = useState<PostMode>("text");
  const [caption, setCaption] = useState("");
  const [code, setCode] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setMode("image");
    }
  }, []);

  const handlePreview = () => {
    const hasContent = caption.trim() || code.trim() || image;
    if (!hasContent) {
      Alert.alert("Post vazio", "Adicione um texto, código ou imagem");
      return;
    }
    setPreviewVisible(true);
  };

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      let mediaUrls: string[] = [];
      let mediaType = "text";
      let postType = mode === "code" ? "code" : mode === "image" ? "image" : "text";
      let finalCaption = caption;

      if (mode === "code" && code.trim()) {
        const lang = detectLanguage(code);
        finalCaption = "```" + lang + "\n" + code.trim() + "\n```";
        if (caption.trim()) finalCaption = caption + "\n\n" + finalCaption;
      }

      if (image) {
        const ext = image.split(".").pop()?.split("?")[0] || "jpg";
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl("posts", ext);
        const blob = await fetch(image).then(r => r.blob());
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        mediaUrls = [publicUrl];
        mediaType = "image";
      }

      await postsService.create(finalCaption, mediaUrls, mediaType, postType);
      setCaption("");
      setCode("");
      setImage(null);
      setMode("text");
      setPreviewVisible(false);
      Alert.alert("✓ Publicado!", "Seu post está no feed.");
      navigation?.navigate?.("Tabs", { screen: "Feed" });
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.message || "Erro ao publicar");
    } finally {
      setPublishing(false);
    }
  }, [caption, code, image, mode]);

  const lang = mode === "code" ? detectLanguage(code) : "";

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Novo post</Text>
        <TouchableOpacity onPress={handlePreview} activeOpacity={0.85}>
          <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.previewBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.previewBtnText}>Prévia →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={[styles.modeRow, { borderBottomColor: theme.border }]}>
        {([
          { key: "text",  icon: "text-outline",       label: "Texto"  },
          { key: "image", icon: "image-outline",       label: "Foto"   },
          { key: "code",  icon: "code-slash-outline",  label: "Código" },
        ] as const).map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeBtn, mode === m.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setMode(m.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={m.icon} size={18} color={mode === m.key ? theme.primary : theme.textSecondary} />
            <Text style={[styles.modeBtnText, { color: mode === m.key ? theme.primary : theme.textSecondary }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={24}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>

          {/* Composer header */}
          <View style={styles.composer}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={42} />
            <View style={styles.composerRight}>
              <Text style={[styles.composerName, { color: theme.text }]}>{user?.displayName || user?.username}</Text>
              <TextInput
                style={[styles.captionInput, { color: theme.text }]}
                placeholder={mode === "code" ? "Descrição do código (opcional)..." : "O que você quer compartilhar?"}
                placeholderTextColor={theme.textSecondary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Code editor */}
          {mode === "code" && (
            <View style={[styles.codeEditor, { backgroundColor: "#1E1E2E", borderColor: "#313244" }]}>
              <View style={styles.codeTopBar}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map(c => (
                    <View key={c} style={[styles.codeDot, { backgroundColor: c }]} />
                  ))}
                </View>
                <Text style={styles.codeLang}>{lang || "auto-detect"}</Text>
              </View>
              <TextInput
                style={styles.codeInput}
                placeholder="// cole seu código aqui..."
                placeholderTextColor="#6C7086"
                value={code}
                onChangeText={setCode}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
              />
            </View>
          )}

          {/* Image mode */}
          {mode === "image" && (
            image ? (
              <View style={styles.imageWrap}>
                <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeImg} onPress={() => { setImage(null); setMode("text"); }}>
                  <View style={styles.removeImgBtn}><Ionicons name="close" size={14} color="#fff" /></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.changeImg} onPress={pickImage}>
                  <View style={styles.changeImgBtn}><Ionicons name="swap-horizontal" size={14} color="#fff" /></View>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addImageBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={pickImage}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={28} color={theme.primaryLight} />
                <Text style={[styles.addImageText, { color: theme.textSecondary }]}>Adicionar imagem</Text>
                <Text style={[styles.addImageSub, { color: theme.textSecondary }]}>JPG, PNG · máx 10MB</Text>
              </TouchableOpacity>
            )
          )}

          {caption.length > 400 && (
            <Text style={[styles.charCount, { color: caption.length > 480 ? theme.error : theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Preview Modal */}
      <Modal visible={previewVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.previewRoot, { backgroundColor: theme.background }]}>
          <View style={[styles.previewHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: theme.text }]}>Prévia</Text>
            <TouchableOpacity onPress={handlePublish} disabled={publishing} style={{ opacity: publishing ? 0.6 : 1 }}>
              <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.publishBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {publishing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.publishText}>Publicar</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={36} />
                <View>
                  <Text style={[{ fontWeight: "700", fontSize: 14 }, { color: theme.text }]}>{user?.displayName || user?.username}</Text>
                  <Text style={[{ fontSize: 11 }, { color: theme.textSecondary }]}>Agora</Text>
                </View>
              </View>
              {caption ? <Text style={[{ fontSize: 14, lineHeight: 20, marginBottom: 8 }, { color: theme.text }]}>{caption}</Text> : null}
              {mode === "code" && code ? (
                <View style={{ backgroundColor: "#1E1E2E", borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: "#CDD6F4", fontFamily: "monospace", fontSize: 12, lineHeight: 18 }}>{code}</Text>
                </View>
              ) : null}
              {image ? <Image source={{ uri: image }} style={{ width: "100%", height: 200, borderRadius: 10, marginTop: 8 }} resizeMode="cover" /> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  previewBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  previewBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  modeRow: { flexDirection: "row", borderBottomWidth: 1 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  modeBtnText: { fontSize: 13, fontWeight: "600" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  composer: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  composerRight: { flex: 1 },
  composerName: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 60 },
  charCount: { fontSize: 11, textAlign: "right" },
  codeEditor: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  codeTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  codeDot: { width: 10, height: 10, borderRadius: 5 },
  codeLang: { color: "#6C7086", fontSize: 11, fontWeight: "600" },
  codeInput: { fontFamily: "monospace", fontSize: 13, color: "#CDD6F4", padding: 12, minHeight: 160, lineHeight: 20 },
  imageWrap: { borderRadius: 16, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: width * 0.75, borderRadius: 16 },
  removeImg: { position: "absolute", top: 10, right: 10 },
  removeImgBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  changeImg: { position: "absolute", top: 10, right: 48 },
  changeImgBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  addImageBtn: { borderWidth: 1.5, borderRadius: 16, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 8 },
  addImageText: { fontSize: 14, fontWeight: "600" },
  addImageSub: { fontSize: 11 },
  previewRoot: { flex: 1 },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  previewTitle: { fontSize: 16, fontWeight: "700" },
  publishBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, minWidth: 80, alignItems: "center", justifyContent: "center", minHeight: 34 },
  publishText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  previewCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
});
