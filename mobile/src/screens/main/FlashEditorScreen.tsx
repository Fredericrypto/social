/**
 * FlashEditorScreen — Editor de Flashes (conteúdo efêmero 24h)
 * v3 — upload via POST /media/upload (multipart) ao invés de presigned URL
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, StatusBar, Alert, ActivityIndicator,
  PanResponder, Animated, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ScrollView,
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

const TEXT_COLORS = [
  "#FFFFFF", "#000000", "#F43F5E", "#F97316",
  "#EAB308", "#22C55E", "#06B6D4", "#8B5CF6",
  "#EC4899", "#A78BFA", "#34D399", "#FB923C",
];

const BG_GRADIENTS: [string, string][] = [
  ["#7C3AED", "#06B6D4"], ["#F43F5E", "#F97316"], ["#0EA5E9", "#22C55E"],
  ["#1E1040", "#3B1F6E"], ["#0F172A", "#1E293B"], ["#7C2D12", "#C2410C"],
  ["#064E3B", "#065F46"], ["#1E3A5F", "#1D4ED8"], ["#4C1D95", "#BE185D"],
  ["#134E4A", "#0E7490"],
];

interface TextLayer {
  id: string; text: string; color: string;
  x: number; y: number; size: number; bold: boolean;
}

type EditorMode = "select" | "camera" | "preview";

export default function FlashEditorScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode]         = useState<EditorMode>("select");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [bgIndex, setBgIndex]   = useState(0);
  const [facing, setFacing]     = useState<"front" | "back">("back");
  const [torchOn, setTorchOn]   = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [textLayers, setTextLayers]             = useState<TextLayer[]>([]);
  const [editingText, setEditingText]           = useState(false);
  const [currentText, setCurrentText]           = useState("");
  const [currentColor, setCurrentColor]         = useState("#FFFFFF");
  const [currentSize, setCurrentSize]           = useState(24);
  const [currentBold, setCurrentBold]           = useState(false);
  const [selectedLayerId, setSelectedLayerId]   = useState<string | null>(null);
  const [uploading, setUploading]               = useState(false);
  const [uploadProgress, setUploadProgress]     = useState("");

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: false,
      quality: 0.92,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setMediaUri(result.assets[0].uri);
      setMode("preview");
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert("Permissão necessária", "Precisamos de acesso à câmera."); return; }
    }
    setTorchOn(false);
    setMode("camera");
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo?.uri) { setMediaUri(photo.uri); setTorchOn(false); setMode("preview"); }
    } catch { Alert.alert("Erro", "Não foi possível tirar a foto."); }
  };

  const addTextLayer = () => {
    if (!currentText.trim()) { setEditingText(false); return; }
    const layer: TextLayer = {
      id: Date.now().toString(), text: currentText.trim(), color: currentColor,
      x: SW / 2 - 60, y: SH / 2 - 20, size: currentSize, bold: currentBold,
    };
    setTextLayers(prev => [...prev, layer]);
    setCurrentText(""); setEditingText(false); setSelectedLayerId(layer.id);
  };

  const removeLayer = (id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handlePublish = async () => {
    const caption = textLayers.map(l => l.text).join(" · ") || undefined;
    if (!mediaUri && !caption) {
      Alert.alert("Flash vazio", "Adicione uma imagem ou texto antes de publicar.");
      return;
    }
    setUploading(true);
    try {
      let mediaUrl = "";
      if (mediaUri) {
        setUploadProgress("Enviando imagem...");
        mediaUrl = await postsService.uploadMedia(mediaUri, "stories");
        setUploadProgress("Publicando...");
      }
      await api.post("/stories", { mediaUrl, caption });
      Alert.alert("Flash publicado! ⚡", "Desaparece em 24 horas.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Tente novamente.";
      Alert.alert("Erro ao publicar", msg);
    } finally {
      setUploading(false); setUploadProgress("");
    }
  };

  const resetEditor = () => { setMediaUri(null); setTextLayers([]); setSelectedLayerId(null); setMode("select"); };

  // ── RENDER: Seleção ──────────────────────────────────────────────────────
  if (mode === "select") {
    const [c1, c2] = BG_GRADIENTS[bgIndex];
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={[s.iconBtn, { top: insets.top + 12, left: 16 }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, { top: insets.top + 12, right: 16 }]} onPress={() => setBgIndex(i => (i + 1) % BG_GRADIENTS.length)} activeOpacity={0.8}>
          <Ionicons name="color-palette-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.selectHero}>
          <Text style={s.heroEmoji}>⚡</Text>
          <Text style={s.heroTitle}>Flash</Text>
          <Text style={s.heroSub}>Some em 24 horas</Text>
        </View>
        <View style={[s.selectCards, { paddingBottom: insets.bottom + 48 }]}>
          <SelectCard icon="camera" label="Câmera"  sub="Foto agora"    onPress={openCamera} />
          <SelectCard icon="images" label="Galeria" sub="Escolher foto" onPress={pickFromGallery} />
          <SelectCard icon="text"   label="Texto"   sub="Flash escrito" onPress={() => { setMediaUri(null); setMode("preview"); }} />
        </View>
      </View>
    );
  }

  // ── RENDER: Câmera ───────────────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing} enableTorch={torchOn} />
        <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "transparent", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        <View style={[s.camTop, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={s.camBtn} onPress={() => setMode("select")} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {facing === "back" && (
              <TouchableOpacity style={[s.camBtn, torchOn && s.camBtnActive]} onPress={() => setTorchOn(t => !t)} activeOpacity={0.8}>
                <Ionicons name={torchOn ? "flash" : "flash-off"} size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.camBtn} onPress={() => { setFacing(f => f === "back" ? "front" : "back"); setTorchOn(false); }} activeOpacity={0.8}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[s.camBottom, { paddingBottom: insets.bottom + 28 }]}>
          <TouchableOpacity style={s.galleryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.shutter} onPress={takePicture} activeOpacity={0.9}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <View style={s.galleryBtn} />
        </View>
      </View>
    );
  }

  // ── RENDER: Editor / Preview ─────────────────────────────────────────────
  const [c1, c2] = BG_GRADIENTS[bgIndex];
  return (
    <View style={s.root}>
      <StatusBar hidden />
      {mediaUri
        ? <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
        : <LinearGradient colors={[c1, c2]} style={StyleSheet.absoluteFillObject} />
      }
      <View style={s.previewOverlay} pointerEvents="none" />

      {textLayers.map(layer => (
        <DraggableText key={layer.id} layer={layer} isSelected={selectedLayerId === layer.id}
          onSelect={() => setSelectedLayerId(layer.id === selectedLayerId ? null : layer.id)}
          onMove={(x, y) => setTextLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x, y } : l))}
        />
      ))}

      {editingText && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFillObject} behavior={Platform.OS === "ios" ? "padding" : "height"} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setEditingText(false); }}>
            <View style={s.textModalBg}>
              <TouchableWithoutFeedback>
                <View style={s.textModal}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
                    {TEXT_COLORS.map(c => (
                      <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, currentColor === c && s.colorDotActive]} onPress={() => setCurrentColor(c)} />
                    ))}
                  </ScrollView>
                  <View style={s.textControls}>
                    <TouchableOpacity style={[s.textCtrlBtn, currentBold && s.textCtrlBtnActive]} onPress={() => setCurrentBold(b => !b)}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.textCtrlBtn} onPress={() => setCurrentSize(sz => Math.max(14, sz - 4))}>
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <View style={s.sizeLabel}><Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{currentSize}</Text></View>
                    <TouchableOpacity style={s.textCtrlBtn} onPress={() => setCurrentSize(sz => Math.min(52, sz + 4))}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[s.textInput, { color: currentColor, fontSize: currentSize, fontWeight: currentBold ? "800" : "400" }]}
                    value={currentText} onChangeText={setCurrentText}
                    placeholder="Digite algo..." placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline autoFocus returnKeyType="done" blurOnSubmit onSubmitEditing={addTextLayer}
                  />
                  <TouchableOpacity style={s.addBtn} onPress={addTextLayer} activeOpacity={0.85}>
                    <Text style={s.addBtnLabel}>Adicionar texto</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.editorBtn} onPress={resetEditor} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!mediaUri && <TouchableOpacity style={s.editorBtn} onPress={() => setBgIndex(i => (i + 1) % BG_GRADIENTS.length)} activeOpacity={0.8}><Ionicons name="color-palette-outline" size={20} color="#fff" /></TouchableOpacity>}
          <TouchableOpacity style={s.editorBtn} onPress={() => { setCurrentText(""); setSelectedLayerId(null); setEditingText(true); }} activeOpacity={0.8}><Ionicons name="text" size={20} color="#fff" /></TouchableOpacity>
          {selectedLayerId && <TouchableOpacity style={[s.editorBtn, { backgroundColor: "rgba(239,68,68,0.75)" }]} onPress={() => removeLayer(selectedLayerId)} activeOpacity={0.8}><Ionicons name="trash-outline" size={18} color="#fff" /></TouchableOpacity>}
        </View>
      </View>

      {textLayers.length > 0 && !editingText && <DragHint />}

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.flashTag}>
          <Ionicons name="flash" size={12} color="#FBBF24" />
          <Text style={s.flashTagText}>24h</Text>
        </View>
        <TouchableOpacity style={[s.publishBtn, uploading && { opacity: 0.55 }]} onPress={handlePublish} disabled={uploading} activeOpacity={0.88}>
          {uploading
            ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ActivityIndicator color="#fff" size="small" /><Text style={s.publishLabel}>{uploadProgress || "Enviando..."}</Text></View>
            : <><Text style={s.publishLabel}>Publicar</Text><Ionicons name="send" size={15} color="#fff" /></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SelectCard({ icon, label, sub, onPress }: { icon: any; label: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.82}>
      <View style={sc.iconWrap}><Ionicons name={icon} size={26} color="#fff" /></View>
      <Text style={sc.label}>{label}</Text>
      <Text style={sc.sub}>{sub}</Text>
    </TouchableOpacity>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.13)", borderRadius: 22, paddingVertical: 24, paddingHorizontal: 8 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },
  sub: { fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" },
});

function DraggableText({ layer, isSelected, onSelect, onMove }: { layer: TextLayer; isSelected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void }) {
  const posX = useRef(new Animated.Value(layer.x)).current;
  const posY = useRef(new Animated.Value(layer.y)).current;
  const cur  = useRef({ x: layer.x, y: layer.y });
  const pan  = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => { posX.setOffset(cur.current.x); posY.setOffset(cur.current.y); posX.setValue(0); posY.setValue(0); onSelect(); },
    onPanResponderMove: Animated.event([null, { dx: posX, dy: posY }], { useNativeDriver: false }),
    onPanResponderRelease: (_e, g) => {
      posX.flattenOffset(); posY.flattenOffset();
      const nx = Math.max(0, Math.min(SW - 80, cur.current.x + g.dx));
      const ny = Math.max(40, Math.min(SH - 80, cur.current.y + g.dy));
      cur.current = { x: nx, y: ny }; posX.setValue(nx); posY.setValue(ny); onMove(nx, ny);
    },
  })).current;
  return (
    <Animated.View style={[dt.wrap, { transform: [{ translateX: posX }, { translateY: posY }] }, isSelected && dt.selected]} {...pan.panHandlers}>
      <Text style={{ color: layer.color, fontSize: layer.size, fontWeight: layer.bold ? "800" : "500", textShadowColor: "rgba(0,0,0,0.65)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }}>{layer.text}</Text>
    </Animated.View>
  );
}
const dt = StyleSheet.create({
  wrap:     { position: "absolute", zIndex: 20, padding: 8 },
  selected: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.7)", borderRadius: 6, borderStyle: "dashed" },
});

function DragHint() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => { const t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(), 2500); return () => clearTimeout(t); }, []);
  return (
    <Animated.View style={[dh.wrap, { opacity }]}>
      <Ionicons name="move-outline" size={12} color="rgba(255,255,255,0.7)" />
      <Text style={dh.text}>Arraste para reposicionar</Text>
    </Animated.View>
  );
}
const dh = StyleSheet.create({
  wrap: { position: "absolute", bottom: 96, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.48)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 5 },
  text: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  iconBtn: { position: "absolute", zIndex: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  selectHero: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  heroEmoji: { fontSize: 56, lineHeight: 70 },
  heroTitle: { fontSize: 32, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.6)", letterSpacing: 0.2 },
  selectCards: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  camTop: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, zIndex: 10 },
  camBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  camBtnActive: { backgroundColor: "rgba(251,191,36,0.55)" },
  camBottom: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 36, zIndex: 10 },
  galleryBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.06)" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, zIndex: 10 },
  editorBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, zIndex: 10 },
  flashTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  flashTagText: { color: "#FBBF24", fontSize: 12, fontWeight: "700" },
  publishBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7C3AED", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 26 },
  publishLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  textModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  textModal: { backgroundColor: "rgba(20,20,30,0.97)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  colorRow: { gap: 8, paddingVertical: 2 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.18 }] },
  textControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  textCtrlBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  textCtrlBtnActive: { backgroundColor: "rgba(124,58,237,0.6)" },
  sizeLabel: { paddingHorizontal: 8 },
  textInput: { minHeight: 56, textAlignVertical: "top", paddingVertical: 4 },
  addBtn: { backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  addBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
