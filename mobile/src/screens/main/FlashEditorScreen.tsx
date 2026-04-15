/**
 * FlashEditorScreen — Editor de Flashes (conteúdo efêmero 24h)
 *
 * Features:
 *  - Galeria ou câmera, SEM crop forçado (imagem ocupa tela inteira)
 *  - Ferramenta de texto sobre a imagem (posição arrastável)
 *  - Paleta de cores para o texto
 *  - Fundo sólido colorido quando não há imagem (Flash de texto puro)
 *  - Upload para MinIO via URL assinada
 *  - POST para /stories com mediaUrl + caption
 *  - Duração fixa de 24h (controlada pelo backend)
 */

import React, {
  useState, useRef, useCallback, useEffect,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, StatusBar, Alert, ActivityIndicator,
  PanResponder, Animated, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard,
} from "react-native";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "../../store/theme.store";
import { postsService } from "../../services/posts.service";
import { api } from "../../services/api";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Paleta de cores para texto ───────────────────────────────────────────────
const TEXT_COLORS = [
  "#FFFFFF", "#000000", "#F43F5E", "#F97316",
  "#EAB308", "#22C55E", "#06B6D4", "#8B5CF6",
  "#EC4899", "#A78BFA",
];

// ─── Fundos sólidos para flashes de texto puro ───────────────────────────────
const BG_GRADIENTS: [string, string][] = [
  ["#7C3AED", "#06B6D4"],
  ["#F43F5E", "#F97316"],
  ["#0EA5E9", "#22C55E"],
  ["#1E1040", "#3B1F6E"],
  ["#0F172A", "#1E293B"],
  ["#7C2D12", "#C2410C"],
  ["#064E3B", "#065F46"],
  ["#1E3A5F", "#1D4ED8"],
];

// ─── Tipo de texto arrastável ─────────────────────────────────────────────────
interface TextLayer {
  id:    string;
  text:  string;
  color: string;
  x:     number; // posição relativa 0–1
  y:     number;
  size:  number;
  bold:  boolean;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlashEditorScreen({ navigation }: any) {
  const { isDark, theme } = useThemeStore();
  const insets            = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // ── Modo ────────────────────────────────────────────────────────────────
  type EditorMode = "select" | "camera" | "preview";
  const [mode,      setMode]      = useState<EditorMode>("select");
  const [mediaUri,  setMediaUri]  = useState<string | null>(null);
  const [isVideo,   setIsVideo]   = useState(false);
  const [bgIndex,   setBgIndex]   = useState(0);
  const [facing,    setFacing]    = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);

  // ── Camada de texto ─────────────────────────────────────────────────────
  const [textLayers,      setTextLayers]      = useState<TextLayer[]>([]);
  const [editingText,     setEditingText]     = useState(false);
  const [currentText,     setCurrentText]     = useState("");
  const [currentColor,    setCurrentColor]    = useState("#FFFFFF");
  const [currentSize,     setCurrentSize]     = useState(22);
  const [currentBold,     setCurrentBold]     = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // ── Upload ──────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);

  // ── Galeria ─────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: false,   // sem crop forçado
      quality: 0.92,
    });
    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setIsVideo(false);
      setMode("preview");
    }
  };

  // ── Câmera ──────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permissão necessária", "Precisamos de acesso à câmera para tirar fotos.");
        return;
      }
    }
    setMode("camera");
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, skipProcessing: true });
      if (photo?.uri) {
        setMediaUri(photo.uri);
        setIsVideo(false);
        setMode("preview");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível tirar a foto.");
    }
  };

  // ── Adicionar camada de texto ────────────────────────────────────────────
  const addTextLayer = () => {
    if (!currentText.trim()) {
      setEditingText(false);
      return;
    }
    const newLayer: TextLayer = {
      id:    Date.now().toString(),
      text:  currentText.trim(),
      color: currentColor,
      x:     0.5 - 0.1,   // centro aprox
      y:     0.45,
      size:  currentSize,
      bold:  currentBold,
    };
    setTextLayers(prev => [...prev, newLayer]);
    setCurrentText("");
    setEditingText(false);
    setSelectedLayerId(newLayer.id);
  };

  const removeSelectedLayer = () => {
    if (!selectedLayerId) return;
    setTextLayers(prev => prev.filter(l => l.id !== selectedLayerId));
    setSelectedLayerId(null);
  };

  // ── Publicar Flash ───────────────────────────────────────────────────────
  const handlePublish = async () => {
    setUploading(true);
    try {
      let mediaUrl: string | undefined;

      if (mediaUri) {
        const ext = mediaUri.split(".").pop()?.split("?")[0] || "jpg";
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl("stories", ext);
        const blob = await fetch(mediaUri).then(r => r.blob());
        await fetch(uploadUrl, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": isVideo ? "video/mp4" : "image/jpeg" },
        });
        mediaUrl = publicUrl;
      }

      // Caption = textos das camadas concatenados (para busca/legenda)
      const caption = textLayers.map(l => l.text).join(" · ") || undefined;

      await api.post("/stories", {
        mediaUrl,
        caption,
        duration: 86400, // 24h em segundos
      });

      Alert.alert("✓ Flash publicado!", "Seu Flash ficará disponível por 24 horas.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.message || "Não foi possível publicar. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Tela de seleção inicial
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === "select") {
    const [r1, r2] = BG_GRADIENTS[bgIndex];
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <LinearGradient colors={[r1, r2]} style={StyleSheet.absoluteFillObject} />

        {/* Botão fechar */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.selectLogo}>
          <Text style={styles.selectLogoText}>⚡</Text>
          <Text style={styles.selectTitle}>Novo Flash</Text>
          <Text style={styles.selectSub}>Desaparece em 24 horas</Text>
        </View>

        {/* Opções */}
        <View style={styles.selectOptions}>
          <TouchableOpacity style={styles.selectCard} onPress={openCamera} activeOpacity={0.85}>
            <View style={[styles.selectCardIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Ionicons name="camera" size={28} color="#fff" />
            </View>
            <Text style={styles.selectCardLabel}>Câmera</Text>
            <Text style={styles.selectCardSub}>Foto na hora</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.selectCard} onPress={pickFromGallery} activeOpacity={0.85}>
            <View style={[styles.selectCardIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Ionicons name="images" size={28} color="#fff" />
            </View>
            <Text style={styles.selectCardLabel}>Galeria</Text>
            <Text style={styles.selectCardSub}>Escolher foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectCard}
            onPress={() => { setMediaUri(null); setMode("preview"); }}
            activeOpacity={0.85}
          >
            <View style={[styles.selectCardIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Ionicons name="text" size={28} color="#fff" />
            </View>
            <Text style={styles.selectCardLabel}>Texto</Text>
            <Text style={styles.selectCardSub}>Flash de texto</Text>
          </TouchableOpacity>
        </View>

        {/* Trocar fundo */}
        <TouchableOpacity
          style={[styles.changeBgBtn, { bottom: insets.bottom + 32 }]}
          onPress={() => setBgIndex(i => (i + 1) % BG_GRADIENTS.length)}
          activeOpacity={0.8}
        >
          <Ionicons name="color-palette-outline" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.changeBgText}>Trocar fundo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Câmera
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
        />

        {/* Botão fechar */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={() => setMode("select")}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Virar câmera */}
        <TouchableOpacity
          style={[styles.flipBtn, { top: insets.top + 12 }]}
          onPress={() => setFacing(f => f === "back" ? "front" : "back")}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Botão de captura */}
        <View style={[styles.shutterArea, { bottom: insets.bottom + 40 }]}>
          <TouchableOpacity style={styles.shutterBtn} onPress={takePicture} activeOpacity={0.9}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Preview / Editor
  // ─────────────────────────────────────────────────────────────────────────
  const [r1, r2] = BG_GRADIENTS[bgIndex];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Fundo: imagem ou gradiente ──────────────────────────────────── */}
      {mediaUri ? (
        <Image
          source={{ uri: mediaUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="contain"   // SEM crop — imagem inteira visível
        />
      ) : (
        <LinearGradient colors={[r1, r2]} style={StyleSheet.absoluteFillObject} />
      )}

      {/* Overlay escuro leve para contraste do texto */}
      <View style={styles.overlay} />

      {/* ── Camadas de texto arrastáveis ─────────────────────────────────── */}
      {textLayers.map(layer => (
        <DraggableText
          key={layer.id}
          layer={layer}
          isSelected={selectedLayerId === layer.id}
          onSelect={() => setSelectedLayerId(layer.id)}
          onMove={(x, y) => setTextLayers(prev =>
            prev.map(l => l.id === layer.id ? { ...l, x, y } : l)
          )}
        />
      ))}

      {/* ── Input de texto flutuante ─────────────────────────────────────── */}
      {editingText && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.textInputOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.textInputCard, { backgroundColor: "rgba(0,0,0,0.72)" }]}>
                {/* Paleta de cores */}
                <View style={styles.colorRow}>
                  {TEXT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        currentColor === c && styles.colorDotActive,
                      ]}
                      onPress={() => setCurrentColor(c)}
                    />
                  ))}
                </View>

                {/* Controles de tamanho e estilo */}
                <View style={styles.textControls}>
                  <TouchableOpacity
                    style={[styles.textCtrlBtn, currentBold && { backgroundColor: "rgba(255,255,255,0.2)" }]}
                    onPress={() => setCurrentBold(b => !b)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textCtrlBtn}
                    onPress={() => setCurrentSize(s => Math.max(14, s - 4))}
                  >
                    <Ionicons name="remove" size={16} color="#fff" />
                  </TouchableOpacity>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{currentSize}px</Text>
                  <TouchableOpacity
                    style={styles.textCtrlBtn}
                    onPress={() => setCurrentSize(s => Math.min(48, s + 4))}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.textInputField,
                    {
                      color: currentColor,
                      fontSize: currentSize,
                      fontWeight: currentBold ? "800" : "400",
                    },
                  ]}
                  value={currentText}
                  onChangeText={setCurrentText}
                  placeholder="Digite algo..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addTextLayer}
                  blurOnSubmit
                />

                <TouchableOpacity style={styles.addTextBtn} onPress={addTextLayer} activeOpacity={0.85}>
                  <Text style={styles.addTextBtnLabel}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* ── Barra superior ───────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => { setMode("select"); setTextLayers([]); setMediaUri(null); }}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* Trocar fundo (quando sem imagem) */}
          {!mediaUri && (
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => setBgIndex(i => (i + 1) % BG_GRADIENTS.length)}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Adicionar texto */}
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => { setCurrentText(""); setEditingText(true); setSelectedLayerId(null); }}
            activeOpacity={0.8}
          >
            <Ionicons name="text" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Remover texto selecionado */}
          {selectedLayerId && (
            <TouchableOpacity
              style={[styles.topBarBtn, { backgroundColor: "rgba(239,68,68,0.7)" }]}
              onPress={removeSelectedLayer}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Dica de drag (some após 3s) */}
      {textLayers.length > 0 && <DragHint />}

      {/* ── Barra inferior — publicar ────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.flashBadge}>
          <Ionicons name="flash" size={13} color="#FBBF24" />
          <Text style={styles.flashBadgeText}>Flash · 24h</Text>
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, uploading && { opacity: 0.6 }]}
          onPress={handlePublish}
          disabled={uploading}
          activeOpacity={0.88}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.publishLabel}>Publicar Flash</Text>
              <Ionicons name="send" size={16} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Componente de texto arrastável ──────────────────────────────────────────
function DraggableText({
  layer, isSelected, onSelect, onMove,
}: {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const pan = useRef(new Animated.ValueXY({
    x: layer.x * SW,
    y: layer.y * SH,
  })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        onSelect();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const nx = Math.max(0, Math.min(1, (pan.x as any)._value / SW));
        const ny = Math.max(0, Math.min(1, (pan.y as any)._value / SH));
        onMove(nx, ny);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.draggableText,
        { transform: pan.getTranslateTransform() },
        isSelected && styles.draggableTextSelected,
      ]}
      {...panResponder.panHandlers}
    >
      <Text style={{
        color:      layer.color,
        fontSize:   layer.size,
        fontWeight: layer.bold ? "800" : "500",
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      }}>
        {layer.text}
      </Text>
    </Animated.View>
  );
}

// ─── Hint "arraste os textos" ─────────────────────────────────────────────────
function DragHint() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }, 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[styles.dragHint, { opacity }]}>
      <Ionicons name="move-outline" size={13} color="rgba(255,255,255,0.7)" />
      <Text style={styles.dragHintText}>Arraste os textos para reposicioná-los</Text>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
    pointerEvents: "none" as any,
  },

  // Tela de seleção
  closeBtn:     { position: "absolute", left: 16, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  selectLogo:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  selectLogoText:{ fontSize: 52 },
  selectTitle:  { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  selectSub:    { fontSize: 14, color: "rgba(255,255,255,0.65)" },
  selectOptions:{ flexDirection: "row", justifyContent: "center", gap: 16, paddingHorizontal: 20, paddingBottom: 80 },
  selectCard:   { flex: 1, alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingVertical: 22, paddingHorizontal: 8 },
  selectCardIcon:{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  selectCardLabel:{ fontSize: 14, fontWeight: "700", color: "#fff" },
  selectCardSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  changeBgBtn:  { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  changeBgText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },

  // Câmera
  flipBtn:    { position: "absolute", right: 16, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  shutterArea:{ position: "absolute", alignSelf: "center", alignItems: "center" },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner:{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },

  // Editor / Preview
  topBar:       { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, zIndex: 10 },
  topBarBtn:    { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },

  bottomBar:    { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 10 },
  flashBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  flashBadgeText:{ color: "#FBBF24", fontSize: 12, fontWeight: "700" },
  publishBtn:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7C3AED", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
  publishLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Input de texto
  textInputOverlay:{ ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  textInputCard:   { width: SW * 0.9, borderRadius: 20, padding: 16, gap: 12 },
  colorRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  colorDot:        { width: 26, height: 26, borderRadius: 13 },
  colorDotActive:  { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.15 }] },
  textControls:    { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  textCtrlBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  textInputField:  { minHeight: 60, textAlignVertical: "top", padding: 4 },
  addTextBtn:      { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  addTextBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Texto arrastável
  draggableText:         { position: "absolute", zIndex: 20, padding: 6 },
  draggableTextSelected: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 6, borderStyle: "dashed" },

  // Hint
  dragHint:     { position: "absolute", bottom: 100, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 5 },
  dragHintText: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
});
