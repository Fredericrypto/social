/**
 * FlashEditorScreen v4
 * Hero cinematográfica · Duração 1h/6h/12h/24h · Câmera frontal · Swipe down
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

// Fundos para flash de texto puro — inclui preto, branco, cinza
const BG_SOLIDS = [
  "#000000", "#FFFFFF", "#6B7280",
];
const BG_GRADIENTS: [string, string][] = [
  ["#7C3AED", "#06B6D4"], ["#F43F5E", "#F97316"], ["#0EA5E9", "#22C55E"],
  ["#1E1040", "#3B1F6E"], ["#0F172A", "#1E293B"], ["#7C2D12", "#C2410C"],
  ["#064E3B", "#065F46"], ["#1E3A5F", "#1D4ED8"], ["#4C1D95", "#BE185D"],
  ["#134E4A", "#0E7490"], ["#1F2937", "#374151"], ["#7F1D1D", "#991B1B"],
  ["#14532D", "#166534"], ["#1E3A8A", "#1D4ED8"], ["#4A044E", "#701A75"],
  ["#0C4A6E", "#0369A1"], ["#422006", "#78350F"], ["#052E16", "#14532D"],
  ["#1C1917", "#292524"],
];

type BgType = { type: "solid"; color: string } | { type: "gradient"; colors: [string, string] };
const ALL_BGS: BgType[] = [
  ...BG_SOLIDS.map(c => ({ type: "solid" as const, color: c })),
  ...BG_GRADIENTS.map(c => ({ type: "gradient" as const, colors: c })),
];

const DURATIONS = [
  { label: "1h",  hours: 1 },
  { label: "6h",  hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

interface TextLayer {
  id: string; text: string; color: string;
  x: number; y: number; size: number; bold: boolean;
}

type EditorMode = "select" | "camera" | "preview";

export default function FlashEditorScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode]           = useState<EditorMode>("select");
  const [mediaUri, setMediaUri]   = useState<string | null>(null);
  const [bgIndex, setBgIndex]     = useState(3); // começa no gradiente roxo/azul
  const [facing, setFacing]       = useState<"front" | "back">("front"); // frontal por padrão
  const [torchOn, setTorchOn]     = useState(false);
  const [duration, setDuration]   = useState(24); // horas
  const cameraRef = useRef<CameraView>(null);

  const [textLayers, setTextLayers]           = useState<TextLayer[]>([]);
  const [editingText, setEditingText]         = useState(false);
  const [currentText, setCurrentText]         = useState("");
  const [currentColor, setCurrentColor]       = useState("#FFFFFF");
  const [currentSize, setCurrentSize]         = useState(24);
  const [currentBold, setCurrentBold]         = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [uploading, setUploading]             = useState(false);
  const [uploadProgress, setUploadProgress]   = useState("");

  // ── Swipe down para fechar ───────────────────────────────────────────────
  const swipeY = useRef(new Animated.Value(0)).current;
  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) swipeY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120) {
        navigation.goBack();
      } else {
        Animated.spring(swipeY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

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
      await api.post("/stories", { mediaUrl, caption, durationHours: duration });
      Alert.alert("Flash publicado! ⚡", `Some em ${duration}h.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Erro ao publicar", e?.response?.data?.message || e?.message || "Tente novamente.");
    } finally {
      setUploading(false); setUploadProgress("");
    }
  };

  const confirmDiscard = () => {
    if (mediaUri || textLayers.length > 0) {
      Alert.alert("Descartar Flash?", "Todo o progresso será perdido.", [
        { text: "Continuar editando", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: resetEditor },
      ]);
    } else {
      resetEditor();
    }
  };

  const resetEditor = () => {
    setMediaUri(null); setTextLayers([]); setSelectedLayerId(null); setMode("select");
  };

  const currentBg = ALL_BGS[bgIndex % ALL_BGS.length];

  // ── RENDER: Seleção ────────────────────────────────────────────────────
  if (mode === "select") {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Hero background — mesh gradient cinematográfico */}
        <LinearGradient
          colors={["#0A0A0F", "#1A0A2E", "#0A1628", "#0A0A0F"]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Orbs decorativos */}
        <View style={s.orb1} />
        <View style={s.orb2} />
        <View style={s.orb3} />

        {/* Fechar */}
        <TouchableOpacity
          style={[s.iconBtn, { top: insets.top + 12, left: 16 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        {/* Hero content */}
        <View style={[s.heroWrap, { paddingTop: insets.top + 60 }]}>
          {/* Badge */}
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>⚡ FLASH</Text>
          </View>

          <Text style={s.heroTitle}>Capture o momento,{"\n"}defina o tempo.</Text>
          <Text style={s.heroSub}>Conteúdo efêmero que some quando você quiser</Text>

          {/* Seletor de duração */}
          <View style={s.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d.hours}
                style={[s.durationBtn, duration === d.hours && s.durationBtnActive]}
                onPress={() => setDuration(d.hours)}
                activeOpacity={0.8}
              >
                <Text style={[s.durationLabel, duration === d.hours && s.durationLabelActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.durationHint}>
            Seu Flash some após {DURATIONS.find(d => d.hours === duration)?.label}
          </Text>
        </View>

        {/* Cards de ação */}
        <View style={[s.actionGrid, { paddingBottom: insets.bottom + 32 }]}>
          <HeroCard
            icon="camera"
            label="Câmera"
            sub="Foto agora"
            accent="#7C3AED"
            onPress={openCamera}
          />
          <HeroCard
            icon="images"
            label="Galeria"
            sub="Escolher foto"
            accent="#0EA5E9"
            onPress={pickFromGallery}
          />
          <HeroCard
            icon="text"
            label="Texto"
            sub="Só palavras"
            accent="#F43F5E"
            onPress={() => { setMediaUri(null); setMode("preview"); }}
          />
        </View>
      </View>
    );
  }

  // ── RENDER: Câmera ─────────────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          enableTorch={torchOn && facing === "back"}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent", "transparent", "rgba(0,0,0,0.6)"]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Topo */}
        <View style={[s.camTop, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={s.camBtn} onPress={() => setMode("select")} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {facing === "back" && (
              <TouchableOpacity
                style={[s.camBtn, torchOn && s.camBtnActive]}
                onPress={() => setTorchOn(t => !t)}
                activeOpacity={0.8}
              >
                <Ionicons name={torchOn ? "flash" : "flash-off"} size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.camBtn}
              onPress={() => { setFacing(f => f === "back" ? "front" : "back"); setTorchOn(false); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Base */}
        <View style={[s.camBottom, { paddingBottom: insets.bottom + 28 }]}>
          <TouchableOpacity style={s.galleryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.shutter} onPress={takePicture} activeOpacity={0.9}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <View style={s.galleryBtn} />
        </View>
      </View>
    );
  }

  // ── RENDER: Editor / Preview ───────────────────────────────────────────
  return (
    <Animated.View style={[s.root, { transform: [{ translateY: swipeY }] }]} {...swipePan.panHandlers}>
      <StatusBar hidden />

      {/* Fundo */}
      {mediaUri ? (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
      ) : currentBg.type === "gradient" ? (
        <LinearGradient colors={currentBg.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: currentBg.color }]} />
      )}
      <View style={s.previewOverlay} pointerEvents="none" />

      {/* Textos arrastáveis */}
      {textLayers.map(layer => (
        <DraggableText
          key={layer.id}
          layer={layer}
          isSelected={selectedLayerId === layer.id}
          onSelect={() => setSelectedLayerId(layer.id === selectedLayerId ? null : layer.id)}
          onMove={(x, y) => setTextLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x, y } : l))}
        />
      ))}

      {/* Modal de texto */}
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

      {/* Barra superior */}
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={s.editorBtn} onPress={confirmDiscard} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {!mediaUri && (
            <TouchableOpacity style={s.editorBtn} onPress={() => setBgIndex(i => (i + 1) % ALL_BGS.length)} activeOpacity={0.8}>
              <Ionicons name="color-palette-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.editorBtn} onPress={() => { setCurrentText(""); setSelectedLayerId(null); setEditingText(true); }} activeOpacity={0.8}>
            <Ionicons name="text" size={20} color="#fff" />
          </TouchableOpacity>
          {selectedLayerId && (
            <TouchableOpacity style={[s.editorBtn, { backgroundColor: "rgba(239,68,68,0.75)" }]} onPress={() => removeLayer(selectedLayerId)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hint swipe */}
      <SwipeHint />

      {textLayers.length > 0 && !editingText && <DragHint />}

      {/* Barra inferior */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Seletor de duração */}
        <View style={s.durationMini}>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.hours}
              style={[s.durationMiniBtn, duration === d.hours && s.durationMiniBtnActive]}
              onPress={() => setDuration(d.hours)}
              activeOpacity={0.8}
            >
              <Text style={[s.durationMiniLabel, duration === d.hours && s.durationMiniLabelActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.publishBtn, uploading && { opacity: 0.55 }]}
          onPress={handlePublish}
          disabled={uploading}
          activeOpacity={0.88}
        >
          {uploading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.publishLabel}>{uploadProgress || "Enviando..."}</Text>
            </View>
          ) : (
            <>
              <Text style={s.publishLabel}>Publicar</Text>
              <Ionicons name="send" size={15} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── HeroCard ──────────────────────────────────────────────────────────────────
function HeroCard({ icon, label, sub, accent, onPress }: {
  icon: any; label: string; sub: string; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={hc.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[hc.iconRing, { borderColor: accent + "55" }]}>
        <View style={[hc.iconFill, { backgroundColor: accent + "22" }]}>
          <Ionicons name={icon} size={24} color={accent} />
        </View>
      </View>
      <Text style={hc.label}>{label}</Text>
      <Text style={hc.sub}>{sub}</Text>
    </TouchableOpacity>
  );
}
const hc = StyleSheet.create({
  card:     { flex: 1, alignItems: "center", gap: 10, paddingVertical: 20, paddingHorizontal: 8 },
  iconRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  iconFill: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  label:    { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: 0.2 },
  sub:      { fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center" },
});

// ── DraggableText ─────────────────────────────────────────────────────────────
function DraggableText({ layer, isSelected, onSelect, onMove }: {
  layer: TextLayer; isSelected: boolean; onSelect: () => void; onMove: (x: number, y: number) => void;
}) {
  const posX = useRef(new Animated.Value(layer.x)).current;
  const posY = useRef(new Animated.Value(layer.y)).current;
  const cur  = useRef({ x: layer.x, y: layer.y });
  const pan  = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      posX.setOffset(cur.current.x); posY.setOffset(cur.current.y);
      posX.setValue(0); posY.setValue(0); onSelect();
    },
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
      <Text style={{ color: layer.color, fontSize: layer.size, fontWeight: layer.bold ? "800" : "500", textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }}>
        {layer.text}
      </Text>
    </Animated.View>
  );
}
const dt = StyleSheet.create({
  wrap:     { position: "absolute", zIndex: 20, padding: 8 },
  selected: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.7)", borderRadius: 6, borderStyle: "dashed" },
});

// ── Hints ─────────────────────────────────────────────────────────────────────
function DragHint() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(), 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[hint.wrap, { opacity, bottom: 96 }]}>
      <Ionicons name="move-outline" size={12} color="rgba(255,255,255,0.7)" />
      <Text style={hint.text}>Arraste para reposicionar</Text>
    </Animated.View>
  );
}

function SwipeHint() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[hint.wrap, { opacity, top: "45%" as any }]}>
      <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.6)" />
      <Text style={hint.text}>Deslize para baixo para cancelar</Text>
    </Animated.View>
  );
}

const hint = StyleSheet.create({
  wrap: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.48)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 5 },
  text: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Orbs decorativos hero
  orb1: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: "#7C3AED", opacity: 0.18, top: -60, right: -80 },
  orb2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#06B6D4", opacity: 0.12, top: 120, left: -60 },
  orb3: { position: "absolute", width: 160, height: 160, borderRadius: 80,  backgroundColor: "#F43F5E", opacity: 0.10, bottom: 160, right: 20 },

  // Hero
  iconBtn:      { position: "absolute", zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  heroWrap:     { flex: 1, paddingHorizontal: 28, gap: 16 },
  heroBadge:    { flexDirection: "row", alignSelf: "flex-start", backgroundColor: "rgba(124,58,237,0.25)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(124,58,237,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  heroBadgeText:{ color: "#A78BFA", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle:    { fontSize: 30, fontWeight: "800", color: "#fff", lineHeight: 38, letterSpacing: -0.5 },
  heroSub:      { fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 20 },
  durationRow:  { flexDirection: "row", gap: 8, marginTop: 8 },
  durationBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)" },
  durationBtnActive: { backgroundColor: "rgba(124,58,237,0.35)", borderColor: "#7C3AED" },
  durationLabel:{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  durationLabelActive: { color: "#A78BFA", fontWeight: "800" },
  durationHint: { fontSize: 12, color: "rgba(255,255,255,0.3)" },
  actionGrid:   { flexDirection: "row", paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },

  // Câmera
  camTop:     { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, zIndex: 10 },
  camBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  camBtnActive:{ backgroundColor: "rgba(251,191,36,0.5)" },
  camBottom:  { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 40, zIndex: 10 },
  galleryBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  shutter:    { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner:{ width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },

  // Editor
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.05)" },
  topBar:     { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, zIndex: 10 },
  editorBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  bottomBar:  { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, zIndex: 10 },

  // Duração mini (editor)
  durationMini:       { flexDirection: "row", gap: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20, padding: 3 },
  durationMiniBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  durationMiniBtnActive: { backgroundColor: "rgba(124,58,237,0.7)" },
  durationMiniLabel:  { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600" },
  durationMiniLabelActive: { color: "#fff", fontWeight: "800" },

  publishBtn:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#7C3AED", paddingHorizontal: 20, paddingVertical: 11, borderRadius: 24 },
  publishLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Modal texto
  textModalBg:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  textModal:      { backgroundColor: "rgba(15,15,20,0.98)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  colorRow:       { gap: 8, paddingVertical: 2 },
  colorDot:       { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.18 }] },
  textControls:   { flexDirection: "row", alignItems: "center", gap: 8 },
  textCtrlBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  textCtrlBtnActive: { backgroundColor: "rgba(124,58,237,0.6)" },
  sizeLabel:      { paddingHorizontal: 8 },
  textInput:      { minHeight: 56, textAlignVertical: "top", paddingVertical: 4 },
  addBtn:         { backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  addBtnLabel:    { color: "#fff", fontWeight: "700", fontSize: 14 },
});
