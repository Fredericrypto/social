/**
 * NewPostScreen — Editor Next-Gen
 *
 * Modos: texto | foto | código | projeto
 * Features:
 *  - Texto: negrito, itálico, toggle curtidas/comentários
 *  - Foto: sem crop, upload com progress bar
 *  - Código: syntax highlight, numeração de linhas, copy to clipboard
 *  - Projeto: repo, tech stack, live demo, status WIP/Concluído/Arquivado
 *  - Preview fiel antes de publicar
 *  - Confirmação ao descartar
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform,
  Modal, Clipboard, Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { postsService } from "../../services/posts.service";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";
import { RichText, RichTextToolbar, TOOLBAR_ID } from "../../components/ui/RichText";

const { width } = Dimensions.get("window");

// ─── Detecção de linguagem ────────────────────────────────────────────────────
function detectLanguage(code: string): string {
  if (code.includes("import React") || code.includes("useState") || code.includes(": React.FC")) return "typescript";
  if (code.includes("def ") || code.includes("print(") || code.includes("import os")) return "python";
  if (code.includes("fun ") && code.includes("val ")) return "kotlin";
  if (code.includes("func ") && code.includes(":=")) return "go";
  if (code.includes("SELECT") || code.includes("FROM ")) return "sql";
  if (code.includes("#!/bin/bash") || code.includes("echo ")) return "bash";
  if (code.includes("<div") || code.includes("</")) return "html";
  if (code.includes("{") && code.includes(":") && code.includes(";")) return "css";
  if (code.includes("fn ") && code.includes("let mut")) return "rust";
  return "javascript";
}

// ─── Tech stack badges disponíveis ───────────────────────────────────────────
const TECH_OPTIONS = [
  "React","React Native","Next.js","Vue","Angular","Svelte",
  "Node.js","NestJS","Express","FastAPI","Django","Laravel",
  "TypeScript","JavaScript","Python","Go","Rust","Java","Kotlin","Swift",
  "PostgreSQL","MySQL","MongoDB","Redis","Prisma","TypeORM",
  "Docker","Kubernetes","AWS","GCP","Railway","Vercel",
  "GraphQL","REST","Socket.io","gRPC",
];

// ─── Status de projeto ────────────────────────────────────────────────────────
type ProjectStatus = "wip" | "done" | "archived";
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  wip:      "Em desenvolvimento",
  done:     "Concluído",
  archived: "Arquivado",
};
const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  wip:      "#F59E0B",
  done:     "#22C55E",
  archived: "#6B7280",
};

type PostMode = "text" | "image" | "code" | "project";

// ─── CodeBlock com line numbers e copy ───────────────────────────────────────
function CodePreview({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={cp.container}>
      <View style={cp.topBar}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {["#FF5F57","#FFBD2E","#28C840"].map(c => (
            <View key={c} style={[cp.dot, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={cp.lang}>{lang}</Text>
        <TouchableOpacity onPress={handleCopy} style={cp.copyBtn} activeOpacity={0.7}>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={13} color={copied ? "#22C55E" : "#6C7086"} />
          <Text style={[cp.copyText, { color: copied ? "#22C55E" : "#6C7086" }]}>
            {copied ? "Copiado!" : "Copiar"}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ padding: 12 }}>
          {lines.map((line, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={cp.lineNum}>{i + 1}</Text>
              <Text style={cp.line}>{line || " "}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const cp = StyleSheet.create({
  container: { backgroundColor: "#1E1E2E", borderRadius: 12, overflow: "hidden", marginTop: 4 },
  topBar:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#313244" },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  lang:      { flex: 1, textAlign: "center", color: "#6C7086", fontSize: 11, fontWeight: "600" },
  copyBtn:   { flexDirection: "row", alignItems: "center", gap: 4 },
  copyText:  { fontSize: 11, fontWeight: "600" },
  lineNum:   { width: 28, color: "#45475A", fontFamily: "monospace", fontSize: 12, lineHeight: 20, textAlign: "right" },
  line:      { color: "#CDD6F4", fontFamily: "monospace", fontSize: 12, lineHeight: 20 },
});

// ─── Upload Progress Bar ──────────────────────────────────────────────────────
function UploadProgress({ progress }: { progress: number }) {
  const { theme } = useThemeStore();
  if (progress <= 0 || progress >= 100) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={[up.track, { backgroundColor: theme.surfaceHigh }]}>
        <View style={[up.bar, { width: `${progress}%` as any, backgroundColor: theme.primary }]} />
      </View>
      <Text style={[up.label, { color: theme.textSecondary }]}>{Math.round(progress)}%</Text>
    </View>
  );
}

const up = StyleSheet.create({
  track: { height: 3, borderRadius: 2, overflow: "hidden" },
  bar:   { height: "100%" },
  label: { fontSize: 10, textAlign: "right", marginTop: 2 },
});

// ─── NewPostScreen ────────────────────────────────────────────────────────────
export default function NewPostScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const insets            = useSafeAreaInsets();

  // ── Estado do editor ──────────────────────────────────────────────────
  const [mode,       setMode]       = useState<PostMode>("text");
  const [caption,    setCaption]    = useState("");
  const [code,       setCode]       = useState("");
  const [image,      setImage]      = useState<string | null>(null);
  const [bold,       setBold]       = useState(false);
  const [italic,     setItalic]     = useState(false);

  // Configurações de engajamento
  const [allowLikes,    setAllowLikes]    = useState(true);
  const [allowComments, setAllowComments] = useState(true);

  // Projeto
  const [projectTitle,  setProjectTitle]  = useState("");
  const [projectDesc,   setProjectDesc]   = useState("");
  const [projectRepo,   setProjectRepo]   = useState("");
  const [projectDemo,   setProjectDemo]   = useState("");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("wip");
  const [projectTechs,  setProjectTechs]  = useState<string[]>([]);
  const [techSearch,    setTechSearch]    = useState("");
  const [projectImages, setProjectImages] = useState<string[]>([]);

  // UI
  const [previewVisible,  setPreviewVisible]  = useState(false);
  const [publishing,      setPublishing]      = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const captionInputRef = React.useRef<any>(null);

  const lang = detectLanguage(code);

  // ── Helpers ───────────────────────────────────────────────────────────
  const hasContent = useCallback(() => {
    if (mode === "text")    return caption.trim().length > 0;
    if (mode === "image")   return !!image;
    if (mode === "code")    return code.trim().length > 0;
    if (mode === "project") return projectTitle.trim().length > 0;
    return false;
  }, [mode, caption, image, code, projectTitle]);

  const handleDiscard = () => {
    if (!hasContent()) { navigation.goBack(); return; }
    Alert.alert("Descartar alterações?", "O rascunho será perdido.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  // ── Galeria de imagens ────────────────────────────────────────────────
  const pickImage = useCallback(async (forProject = false) => {
    // Solicitar permissão explicitamente (obrigatório em Android/iOS)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações do dispositivo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,   // sem crop forçado
      quality: 0.9,
      allowsMultipleSelection: forProject,
    });
    if (!result.canceled) {
      if (forProject) {
        const uris = result.assets.map(a => a.uri);
        setProjectImages(prev => [...prev, ...uris].slice(0, 6));
      } else {
        setImage(result.assets[0].uri);
        setMode("image");
      }
    }
  }, []);

  // ── Upload com progresso ──────────────────────────────────────────────
  const uploadImage = async (uri: string, folder = "posts"): Promise<string> => {
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const { uploadUrl, publicUrl } = await postsService.getUploadUrl(folder, ext);
    const blob = await fetch(uri).then(r => r.blob());

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", "image/jpeg");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
      };
      xhr.onload  = () => { setUploadProgress(100); resolve(publicUrl); };
      xhr.onerror = () => reject(new Error("Upload falhou"));
      xhr.send(blob);
    });
  };

  // ── Publicar ──────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setUploadProgress(0);
    try {
      let mediaUrls: string[] = [];
      let finalCaption = caption;
      let postType = mode;

      if (mode === "code" && code.trim()) {
        const detectedLang = detectLanguage(code);
        const codeBlock = "```" + detectedLang + "\n" + code.trim() + "\n```";
        finalCaption = caption.trim() ? caption.trim() + "\n\n" + codeBlock : codeBlock;
      }

      if (mode === "image" && image) {
        const publicUrl = await uploadImage(image);
        mediaUrls = [publicUrl];
      }

      if (mode === "project") {
        // Upload de screenshots do projeto
        const uploadedImgs: string[] = [];
        for (let i = 0; i < projectImages.length; i++) {
          setUploadProgress((i / projectImages.length) * 80);
          const url = await uploadImage(projectImages[i]);
          uploadedImgs.push(url);
        }
        mediaUrls = uploadedImgs;

        // Serializa dados do projeto no caption como JSON estruturado
        const projectData = {
          title:   projectTitle.trim(),
          desc:    projectDesc.trim(),
          repo:    projectRepo.trim(),
          demo:    projectDemo.trim(),
          status:  projectStatus,
          techs:   projectTechs,
        };
        finalCaption = JSON.stringify(projectData);
      }

      setUploadProgress(90);

      await postsService.create(finalCaption, mediaUrls, mode, postType);

      setUploadProgress(100);

      // Reset
      setCaption(""); setCode(""); setImage(null); setMode("text");
      setProjectTitle(""); setProjectDesc(""); setProjectRepo("");
      setProjectDemo(""); setProjectTechs([]); setProjectImages([]);
      setPreviewVisible(false);

      navigation?.navigate?.("Tabs", { screen: "Feed" });
    } catch (e: any) {
      Alert.alert("Erro ao publicar", e?.response?.data?.message || "Tente novamente.");
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  }, [caption, code, image, mode, projectTitle, projectDesc, projectRepo, projectDemo, projectStatus, projectTechs, projectImages]);

  const handlePreview = () => {
    if (!hasContent()) {
      Alert.alert("Post vazio", "Adicione conteúdo antes de ver a prévia.");
      return;
    }
    setPreviewVisible(true);
  };

  // ── Modos ─────────────────────────────────────────────────────────────
  const MODES: { key: PostMode; icon: string; label: string }[] = [
    { key: "text",    icon: "text-outline",      label: "Texto"   },
    { key: "image",   icon: "image-outline",      label: "Foto"    },
    { key: "code",    icon: "code-slash-outline", label: "Código"  },
    { key: "project", icon: "briefcase-outline",  label: "Projeto" },
  ];

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, {
        paddingTop: insets.top + 10,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
      }]}>
        <TouchableOpacity onPress={handleDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Novo post</Text>
        <TouchableOpacity onPress={handlePreview} activeOpacity={0.85}>
          <LinearGradient
            colors={[theme.primary, theme.primaryLight]}
            style={s.previewBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={s.previewBtnText}>Prévia →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Seletor de modo */}
      <View style={[s.modeRow, { borderBottomColor: theme.border }]}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.modeBtn, mode === m.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setMode(m.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={m.icon as any} size={17} color={mode === m.key ? theme.primary : theme.textSecondary} />
            <Text style={[s.modeBtnText, { color: mode === m.key ? theme.primary : theme.textSecondary }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 60 }]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Composer com avatar */}
          <View style={s.composer}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={42} />
            <View style={s.composerRight}>
              <Text style={[s.composerName, { color: theme.text }]}>
                {user?.displayName || user?.username}
              </Text>

              {mode !== "project" && (
                <TextInput
                  ref={captionInputRef}
                  inputAccessoryViewID={Platform.OS === "ios" ? TOOLBAR_ID : undefined}
                  style={[s.captionInput, {
                    color: theme.text,
                  }]}
                  placeholder={
                    mode === "code"  ? "Descrição do código (opcional)..." :
                    mode === "image" ? "Legenda da foto..." :
                    "O que você quer compartilhar?"
                  }
                  placeholderTextColor={theme.textSecondary}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  underlineColorAndroid="transparent"
                />
              )}
            </View>
          </View>

          {/* Toolbar de rich text — Android: aparece aqui; iOS: via InputAccessoryView */}
          {mode === "text" && Platform.OS === "android" && (
            <RichTextToolbar
              inputRef={captionInputRef}
              value={caption}
              onChangeText={setCaption}
            />
          )}

          {/* Editor de código */}
          {mode === "code" && (
            <View style={[s.codeEditor, { borderColor: "#313244" }]}>
              <View style={s.codeTopBar}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map(c => (
                    <View key={c} style={[s.codeDot, { backgroundColor: c }]} />
                  ))}
                </View>
                <Text style={s.codeLangLabel}>{lang}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                {/* Números de linha */}
                <View style={s.lineNumbers}>
                  {(code || " ").split("\n").map((_, i) => (
                    <Text key={i} style={s.lineNum}>{i + 1}</Text>
                  ))}
                </View>
                <TextInput
                  style={s.codeInput}
                  placeholder={"// cole seu código aqui..."}
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
            </View>
          )}

          {/* Upload de imagem */}
          {mode === "image" && (
            image ? (
              <View style={s.imageWrap}>
                <Image
                  source={{ uri: image }}
                  style={s.imagePreview}
                  resizeMode="contain"   // sem crop
                />
                <TouchableOpacity style={s.imgActionBtn} onPress={() => { setImage(null); }}>
                  <View style={s.imgActionBtnInner}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[s.imgActionBtn, { right: 48 }]} onPress={() => pickImage()}>
                  <View style={s.imgActionBtnInner}>
                    <Ionicons name="swap-horizontal" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <UploadProgress progress={uploadProgress} />
              </View>
            ) : (
              <TouchableOpacity
                style={[s.addImageBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={() => pickImage()}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={28} color={theme.primaryLight} />
                <Text style={[s.addImageText, { color: theme.textSecondary }]}>Adicionar imagem</Text>
                <Text style={[s.addImageSub, { color: theme.textTertiary }]}>JPG, PNG · sem crop forçado</Text>
              </TouchableOpacity>
            )
          )}

          {/* Editor de projeto */}
          {mode === "project" && (
            <View style={s.projectForm}>
              {/* Título */}
              <View style={[s.projectField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary }]}>NOME DO PROJETO</Text>
                <TextInput
                  style={[s.projectFieldInput, { color: theme.text }]}
                  placeholder="Ex: Minha Rede Social"
                  placeholderTextColor={theme.textSecondary}
                  value={projectTitle}
                  onChangeText={setProjectTitle}
                  maxLength={80}
                />
              </View>

              {/* Descrição */}
              <View style={[s.projectField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary }]}>DESCRIÇÃO</Text>
                <TextInput
                  style={[s.projectFieldInput, { color: theme.text, minHeight: 72 }]}
                  placeholder="O que esse projeto faz? Qual problema resolve?"
                  placeholderTextColor={theme.textSecondary}
                  value={projectDesc}
                  onChangeText={setProjectDesc}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
              </View>

              {/* Status */}
              <View style={s.projectStatusRow}>
                {(["wip","done","archived"] as ProjectStatus[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.statusBtn,
                      { borderColor: PROJECT_STATUS_COLORS[st] + "66" },
                      projectStatus === st && { backgroundColor: PROJECT_STATUS_COLORS[st] + "22" },
                    ]}
                    onPress={() => setProjectStatus(st)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.statusDot, { backgroundColor: PROJECT_STATUS_COLORS[st] }]} />
                    <Text style={[s.statusText, { color: projectStatus === st ? PROJECT_STATUS_COLORS[st] : theme.textSecondary }]}>
                      {PROJECT_STATUS_LABELS[st]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Repo + Demo */}
              <View style={[s.projectField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary }]}>REPOSITÓRIO</Text>
                <TextInput
                  style={[s.projectFieldInput, { color: theme.primaryLight }]}
                  placeholder="https://github.com/..."
                  placeholderTextColor={theme.textSecondary}
                  value={projectRepo}
                  onChangeText={setProjectRepo}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <View style={[s.projectField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary }]}>LIVE DEMO</Text>
                <TextInput
                  style={[s.projectFieldInput, { color: theme.primaryLight }]}
                  placeholder="https://meu-projeto.vercel.app"
                  placeholderTextColor={theme.textSecondary}
                  value={projectDemo}
                  onChangeText={setProjectDemo}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              {/* Tech stack */}
              <View>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary, marginBottom: 8 }]}>TECH STACK</Text>
                <TextInput
                  style={[s.techSearch, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder="Buscar tecnologia..."
                  placeholderTextColor={theme.textSecondary}
                  value={techSearch}
                  onChangeText={setTechSearch}
                  autoCapitalize="none"
                />
                {/* Tags selecionadas */}
                {projectTechs.length > 0 && (
                  <View style={s.techChips}>
                    {projectTechs.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[s.techChip, { backgroundColor: theme.primary + "22", borderColor: theme.primary + "44" }]}
                        onPress={() => setProjectTechs(prev => prev.filter(x => x !== t))}
                      >
                        <Text style={[s.techChipText, { color: theme.primaryLight }]}>{t}</Text>
                        <Ionicons name="close" size={10} color={theme.primaryLight} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Sugestões filtradas */}
                <View style={s.techSuggestions}>
                  {TECH_OPTIONS
                    .filter(t =>
                      !projectTechs.includes(t) &&
                      (techSearch === "" || t.toLowerCase().includes(techSearch.toLowerCase()))
                    )
                    .slice(0, 12)
                    .map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[s.techSuggestion, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}
                        onPress={() => { setProjectTechs(prev => [...prev, t]); setTechSearch(""); }}
                      >
                        <Text style={[s.techSuggestionText, { color: theme.text }]}>{t}</Text>
                      </TouchableOpacity>
                    ))
                  }
                </View>
              </View>

              {/* Screenshots */}
              <View>
                <Text style={[s.projectFieldLabel, { color: theme.textTertiary, marginBottom: 8 }]}>
                  SCREENSHOTS ({projectImages.length}/6)
                </Text>
                <View style={s.screenshotRow}>
                  {projectImages.map((uri, i) => (
                    <View key={i} style={s.screenshotThumb}>
                      <Image source={{ uri }} style={s.screenshotImg} resizeMode="cover" />
                      <TouchableOpacity
                        style={s.screenshotRemove}
                        onPress={() => setProjectImages(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {projectImages.length < 6 && (
                    <TouchableOpacity
                      style={[s.screenshotAdd, { borderColor: theme.border, backgroundColor: theme.surface }]}
                      onPress={() => pickImage(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Configurações de engajamento */}
          {mode !== "project" && (
            <View style={[s.engagementRow, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={s.engagementBtn}
                onPress={() => setAllowLikes(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={allowLikes ? "heart" : "heart-outline"}
                  size={17}
                  color={allowLikes ? "#F43F5E" : theme.textTertiary}
                />
                <Text style={[s.engagementText, { color: allowLikes ? theme.text : theme.textTertiary }]}>
                  Curtidas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.engagementBtn}
                onPress={() => setAllowComments(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={allowComments ? "chatbubble" : "chatbubble-outline"}
                  size={16}
                  color={allowComments ? theme.primary : theme.textTertiary}
                />
                <Text style={[s.engagementText, { color: allowComments ? theme.text : theme.textTertiary }]}>
                  Comentários
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {caption.length > 400 && (
            <Text style={[s.charCount, { color: caption.length > 480 ? theme.error : theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toolbar de rich text iOS — flutua acima do teclado */}
      {mode === "text" && Platform.OS === "ios" && (
        <RichTextToolbar
          inputRef={captionInputRef}
          value={caption}
          onChangeText={setCaption}
        />
      )}

      {/* Modal de Preview */}
      <Modal visible={previewVisible} animationType="slide" statusBarTranslucent>
        <View style={[s.previewRoot, { backgroundColor: theme.background }]}>
          <View style={[s.previewHeader, {
            paddingTop: insets.top + 10,
            borderBottomColor: theme.border,
            backgroundColor: theme.background,
          }]}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <Text style={[s.previewTitle, { color: theme.text }]}>Prévia</Text>
            <TouchableOpacity
              onPress={handlePublish}
              disabled={publishing}
              style={{ opacity: publishing ? 0.6 : 1 }}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryLight]}
                style={s.publishBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {publishing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.publishText}>Publicar</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <UploadProgress progress={uploadProgress} />

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Card de preview fiel */}
            <View style={[s.previewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Header do post */}
              <View style={s.previewPostHeader}>
                <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={38} />
                <View>
                  <Text style={[{ fontWeight: "700", fontSize: 14 }, { color: theme.text }]}>
                    {user?.displayName || user?.username}
                  </Text>
                  <Text style={[{ fontSize: 11 }, { color: theme.textSecondary }]}>Agora</Text>
                </View>
              </View>

              {/* Conteúdo */}
              {mode === "code" ? (
                <>
                  {caption.trim() ? (
                    <Text style={[s.previewCaption, { color: theme.text }]}>{caption}</Text>
                  ) : null}
                  <CodePreview code={code} lang={lang} />
                </>
              ) : mode === "project" ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[{ fontSize: 17, fontWeight: "800" }, { color: theme.text }]}>
                      {projectTitle || "Nome do projeto"}
                    </Text>
                    <View style={[s.statusChip, { backgroundColor: PROJECT_STATUS_COLORS[projectStatus] + "22" }]}>
                      <View style={[s.statusDot, { backgroundColor: PROJECT_STATUS_COLORS[projectStatus] }]} />
                      <Text style={[{ fontSize: 10, fontWeight: "700" }, { color: PROJECT_STATUS_COLORS[projectStatus] }]}>
                        {PROJECT_STATUS_LABELS[projectStatus].toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {projectDesc ? <Text style={[{ fontSize: 13, lineHeight: 19 }, { color: theme.textSecondary }]}>{projectDesc}</Text> : null}
                  {projectTechs.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                      {projectTechs.map(t => (
                        <View key={t} style={[s.techChip, { backgroundColor: theme.primary + "22", borderColor: theme.primary + "44" }]}>
                          <Text style={[s.techChipText, { color: theme.primaryLight }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {projectImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {projectImages.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={{ width: 200, height: 120, borderRadius: 10, marginRight: 8 }} resizeMode="cover" />
                      ))}
                    </ScrollView>
                  )}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {projectRepo ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="logo-github" size={14} color={theme.primaryLight} />
                        <Text style={[{ fontSize: 12 }, { color: theme.primaryLight }]}>Repositório</Text>
                      </View>
                    ) : null}
                    {projectDemo ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="open-outline" size={14} color={theme.primaryLight} />
                        <Text style={[{ fontSize: 12 }, { color: theme.primaryLight }]}>Live Demo</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <>
                  {caption ? <RichText text={caption} style={[s.previewCaption, { color: theme.text }]} /> : null}
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={{ width: "100%", maxHeight: 400, borderRadius: 10, marginTop: 8 }}
                      resizeMode="contain"
                    />
                  ) : null}
                </>
              )}

              {/* Engajamento preview */}
              <View style={[s.previewActions, { borderTopColor: theme.border }]}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: allowLikes ? 1 : 0.3 }}>
                    <Ionicons name="heart-outline" size={18} color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>0</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: allowComments ? 1 : 0.3 }}>
                    <Ionicons name="chatbubble-outline" size={17} color={theme.textSecondary} />
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>0</Text>
                  </View>
                </View>
                <Ionicons name="bookmark-outline" size={18} color={theme.textSecondary} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:      { fontSize: 18, fontWeight: "800" },
  previewBtn:       { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  previewBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  modeRow:          { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  modeBtn:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11 },
  modeBtnText:      { fontSize: 12, fontWeight: "600" },
  content:          { padding: 16, gap: 16 },
  composer:         { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  composerRight:    { flex: 1 },
  composerName:     { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  captionInput:     { fontSize: 15, lineHeight: 22, minHeight: 60 },
  charCount:        { fontSize: 11, textAlign: "right" },

  // Formatação
  formatBar:        { flexDirection: "row", gap: 4, padding: 8, borderRadius: 12, borderWidth: 1 },
  fmtBtn:           { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  fmtBtnText:       { fontSize: 14 },

  // Code editor
  codeEditor:       { backgroundColor: "#1E1E2E", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  codeTopBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#313244" },
  codeDot:          { width: 10, height: 10, borderRadius: 5 },
  codeLangLabel:    { color: "#6C7086", fontSize: 11, fontWeight: "600" },
  lineNumbers:      { paddingTop: 12, paddingLeft: 8, paddingRight: 4, alignItems: "flex-end" },
  lineNum:          { color: "#45475A", fontFamily: "monospace", fontSize: 12, lineHeight: 20, width: 24, textAlign: "right" },
  codeInput:        { flex: 1, fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, minHeight: 160, lineHeight: 20 },

  // Image
  imageWrap:        { borderRadius: 16, overflow: "hidden", position: "relative" },
  imagePreview:     { width: "100%", minHeight: 200, maxHeight: width * 1.2, borderRadius: 16 },
  imgActionBtn:     { position: "absolute", top: 10, right: 10 },
  imgActionBtnInner:{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  addImageBtn:      { borderWidth: 1.5, borderRadius: 16, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 8 },
  addImageText:     { fontSize: 14, fontWeight: "600" },
  addImageSub:      { fontSize: 11 },

  // Engajamento
  engagementRow:    { flexDirection: "row", gap: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  engagementBtn:    { flexDirection: "row", alignItems: "center", gap: 6 },
  engagementText:   { fontSize: 13, fontWeight: "500" },

  // Projeto
  projectForm:      { gap: 14 },
  projectField:     { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  projectFieldLabel:{ fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  projectFieldInput:{ fontSize: 14, paddingTop: 4 },
  projectStatusRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statusBtn:        { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  statusDot:        { width: 7, height: 7, borderRadius: 4 },
  statusText:       { fontSize: 12, fontWeight: "600" },
  statusChip:       { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  techSearch:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  techChips:        { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  techChip:         { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  techChipText:     { fontSize: 11, fontWeight: "600" },
  techSuggestions:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  techSuggestion:   { borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  techSuggestionText:{ fontSize: 12, fontWeight: "500" },
  screenshotRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  screenshotThumb:  { width: 100, height: 70, borderRadius: 8, overflow: "hidden", position: "relative" },
  screenshotImg:    { width: "100%", height: "100%" },
  screenshotRemove: { position: "absolute", top: 2, right: 2 },
  screenshotAdd:    { width: 100, height: 70, borderRadius: 8, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },

  // Preview modal
  previewRoot:       { flex: 1 },
  previewHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  previewTitle:      { fontSize: 16, fontWeight: "700" },
  publishBtn:        { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, minWidth: 80, alignItems: "center", justifyContent: "center", minHeight: 34 },
  publishText:       { color: "#fff", fontSize: 13, fontWeight: "700" },
  previewCard:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  previewPostHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewCaption:    { fontSize: 14, lineHeight: 21 },
  previewActions:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
});
