/**
 * FlashEditorScreen v7 — Canvas Imersivo de Elite
 *
 * ✅ Tap em área vazia → abre editor de texto instantaneamente
 * ✅ Tap em texto existente → edita aquele bloco
 * ✅ Pan + Pinch + Rotate simultâneos por camada (Reanimated 4)
 * ✅ Double-tap em camada → espelha
 * ✅ Fundo não some com teclado (Modal independente)
 * ✅ Galeria com permissão correta
 * ✅ Upload com compressão Supabase
 * ✅ Modais next-gen (sem Alert nativo)
 * ✅ Zona do polegar — botões na base
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, StatusBar, ActivityIndicator,
  Modal, TouchableWithoutFeedback, Keyboard,
  ScrollView, Platform,
} from "react-native";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS,
  withSpring, withTiming,
} from "react-native-reanimated";
import {
  GestureDetector, Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import * as NavigationBar from "expo-navigation-bar";
import { useThemeStore } from "../../store/theme.store";
import { postsService } from "../../services/posts.service";
import { api } from "../../services/api";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Constantes ───────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  "#FFFFFF","#F8FAFC","#000000","#1E293B",
  "#F43F5E","#F97316","#EAB308","#22C55E",
  "#06B6D4","#3B82F6","#8B5CF6","#EC4899",
  "#A78BFA","#34D399","#FB923C","#F472B6",
];

const FONT_SIZES = [16, 20, 24, 28, 36, 44];

type BgItem = { type: "solid"; color: string } | { type: "gradient"; colors: [string, string] };
const BACKGROUNDS: BgItem[] = [
  { type: "gradient", colors: ["#7C3AED", "#06B6D4"] },
  { type: "gradient", colors: ["#F43F5E", "#F97316"] },
  { type: "gradient", colors: ["#0EA5E9", "#22C55E"] },
  { type: "gradient", colors: ["#1E1040", "#3B1F6E"] },
  { type: "gradient", colors: ["#0F172A", "#1E293B"] },
  { type: "gradient", colors: ["#4C1D95", "#BE185D"] },
  { type: "gradient", colors: ["#134E4A", "#0E7490"] },
  { type: "gradient", colors: ["#7C2D12", "#C2410C"] },
  { type: "gradient", colors: ["#064E3B", "#065F46"] },
  { type: "gradient", colors: ["#1E3A8A", "#1D4ED8"] },
  { type: "gradient", colors: ["#422006", "#78350F"] },
  { type: "gradient", colors: ["#1C1917", "#292524"] },
  { type: "solid",    color: "#000000" },
  { type: "solid",    color: "#FFFFFF" },
  { type: "solid",    color: "#6B7280" },
  { type: "solid",    color: "#1E293B" },
  { type: "solid",    color: "#7C3AED" },
  { type: "solid",    color: "#06B6D4" },
  { type: "solid",    color: "#F43F5E" },
  { type: "solid",    color: "#22C55E" },
  { type: "solid",    color: "#F97316" },
  { type: "solid",    color: "#EAB308" },
];

const DURATIONS = [
  { label: "1h",  hours: 1  },
  { label: "6h",  hours: 6  },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

interface TextLayer {
  id:        string;
  text:      string;
  color:     string;
  size:      number;
  bold:      boolean;
  italic:    boolean;
  highlight: boolean;
  mirrored:  boolean;
  // posição inicial persistida
  initX:     number;
  initY:     number;
}

type EditorMode = "select" | "camera" | "preview";

// ─── Camada de texto com gestos completos ────────────────────────────────────
function TextLayerView({
  layer, isSelected, onSelect, onEdit, onMirror,
}: {
  layer:     TextLayer;
  isSelected: boolean;
  onSelect:  () => void;
  onEdit:    () => void;
  onMirror:  () => void;
}) {
  const tx  = useSharedValue(layer.initX);
  const ty  = useSharedValue(layer.initY);
  const sc  = useSharedValue(1);
  const ro  = useSharedValue(0);
  const stx = useSharedValue(layer.initX);
  const sty = useSharedValue(layer.initY);
  const ssc = useSharedValue(1);
  const sro = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => { stx.value = tx.value; sty.value = ty.value; })
    .onUpdate(e => {
      tx.value = stx.value + e.translationX;
      ty.value = sty.value + e.translationY;
    })
    .onEnd(() => { stx.value = tx.value; sty.value = ty.value; });

  const pinch = Gesture.Pinch()
    .onStart(() => { ssc.value = sc.value; })
    .onUpdate(e => { sc.value = Math.max(0.3, Math.min(5, ssc.value * e.scale)); })
    .onEnd(() => { ssc.value = sc.value; });

  const rotate = Gesture.Rotation()
    .onStart(() => { sro.value = ro.value; })
    .onUpdate(e => { ro.value = sro.value + e.rotation; })
    .onEnd(() => { sro.value = ro.value; });

  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => { runOnJS(onSelect)(); });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => { runOnJS(onMirror)(); });

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .onEnd(() => { runOnJS(onEdit)(); });

  const composed = Gesture.Simultaneous(
    Gesture.Simultaneous(pan, Gesture.Simultaneous(pinch, rotate)),
    Gesture.Exclusive(doubleTap, Gesture.Exclusive(longPress, tap)),
  );

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
      { rotateZ: `${ro.value}rad` },
      { scaleX: layer.mirrored ? -1 : 1 },
    ],
    opacity: withTiming(isSelected ? 1 : 0.92, { duration: 120 }),
  }));

  const textShadow = layer.highlight ? {} : {
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[tl.wrap, aStyle, isSelected && tl.selected]}>
        <Text style={[{
          color:      layer.color,
          fontSize:   layer.size,
          fontWeight: layer.bold   ? "800" : "400",
          fontStyle:  layer.italic ? "italic" : "normal",
          backgroundColor: layer.highlight ? "rgba(0,0,0,0.65)" : "transparent",
          paddingHorizontal: layer.highlight ? 10 : 0,
          paddingVertical:   layer.highlight ? 4  : 0,
          borderRadius:      layer.highlight ? 8  : 0,
        }, textShadow]}>
          {layer.text}
        </Text>
        {/* Indicador de seleção */}
        {isSelected && (
          <View style={tl.selDot} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const tl = StyleSheet.create({
  wrap:     { position: "absolute", zIndex: 20, padding: 8 },
  selected: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 8,
    borderStyle:  "dashed",
  },
  selDot: {
    position: "absolute", top: -4, right: -4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#7C3AED",
  },
});

// ─── Modal next-gen reutilizável ──────────────────────────────────────────────
function AppModal({ visible, onClose, children }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={mod.backdrop}>
          <TouchableWithoutFeedback>
            <View style={mod.sheet}>
              <BlurView intensity={90} tint="dark" style={mod.blur}>
                {children}
              </BlurView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const mod = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(8,8,12,0.9)",
  },
  blur: { paddingBottom: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function FlashEditorScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  // Esconde nav bar Android
  useEffect(() => {
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync("visible").catch(() => {});
      NavigationBar.setBackgroundColorAsync(theme.background).catch(() => {});
    };
  }, []);

  // ── State ────────────────────────────────────────────────────────────────
  const [mode,     setMode]     = useState<EditorMode>("select");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [bgIndex,  setBgIndex]  = useState(0);
  const [facing,   setFacing]   = useState<"front" | "back">("front");
  const [torchOn,  setTorchOn]  = useState(false);
  const [duration, setDuration] = useState(24);
  const cameraRef = useRef<CameraView>(null);

  const [textLayers,  setTextLayers]  = useState<TextLayer[]>([]);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadMsg,   setUploadMsg]   = useState("");

  // Modais
  const [textModal,    setTextModal]    = useState(false);
  const [editingLayer, setEditingLayer] = useState<TextLayer | null>(null); // null = novo
  const [discardModal, setDiscardModal] = useState(false);

  // State do editor de texto
  const [draft,       setDraft]       = useState("");
  const [editColor,   setEditColor]   = useState("#FFFFFF");
  const [editSize,    setEditSize]    = useState(24);
  const [editBold,    setEditBold]    = useState(false);
  const [editItalic,  setEditItalic]  = useState(false);
  const [editHL,      setEditHL]      = useState(false);

  const selectedLayer = textLayers.find(l => l.id === selectedId);
  const currentBg     = BACKGROUNDS[bgIndex % BACKGROUNDS.length];

  // ── Abrir editor de texto ────────────────────────────────────────────────
  const openNewText = useCallback(() => {
    setEditingLayer(null);
    setDraft(""); setEditColor("#FFFFFF"); setEditSize(24);
    setEditBold(false); setEditItalic(false); setEditHL(false);
    setTextModal(true);
  }, []);

  const openEditText = useCallback((layer: TextLayer) => {
    setEditingLayer(layer);
    setDraft(layer.text); setEditColor(layer.color); setEditSize(layer.size);
    setEditBold(layer.bold); setEditItalic(layer.italic); setEditHL(layer.highlight);
    setTextModal(true);
  }, []);

  // ── Confirmar texto ──────────────────────────────────────────────────────
  const commitText = () => {
    if (!draft.trim()) { setTextModal(false); return; }
    if (editingLayer) {
      // Edita camada existente
      setTextLayers(prev => prev.map(l => l.id === editingLayer.id
        ? { ...l, text: draft.trim(), color: editColor, size: editSize, bold: editBold, italic: editItalic, highlight: editHL }
        : l
      ));
    } else {
      // Nova camada — posição central
      const layer: TextLayer = {
        id:        Date.now().toString(),
        text:      draft.trim(),
        color:     editColor,
        size:      editSize,
        bold:      editBold,
        italic:    editItalic,
        highlight: editHL,
        mirrored:  false,
        initX:     SW / 2 - 60,
        initY:     SH * 0.35,
      };
      setTextLayers(prev => [...prev, layer]);
      setSelectedId(layer.id);
    }
    setTextModal(false);
    Keyboard.dismiss();
  };

  const deleteLayer = (id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const mirrorLayer = (id: string) => {
    setTextLayers(prev => prev.map(l => l.id === id ? { ...l, mirrored: !l.mirrored } : l));
  };

  // ── Galeria ──────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    if (!mediaPermission?.granted) {
      const { granted } = await requestMediaPermission();
      if (!granted) { return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaType.Images,
      allowsEditing: false,
      quality:       1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setMediaUri(result.assets[0].uri);
      setMode("preview");
    }
  };

  // ── Câmera ───────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { return; }
    }
    setTorchOn(false);
    setMode("camera");
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo?.uri) { setMediaUri(photo.uri); setTorchOn(false); setMode("preview"); }
    } catch {}
  };

  // ── Publicar ─────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    const caption = textLayers.map(l => l.text).join(" · ") || undefined;
    if (!mediaUri && !caption) { openNewText(); return; }
    setUploading(true);
    try {
      let mediaUrl = "";
      if (mediaUri) {
        setUploadMsg("Comprimindo...");
        mediaUrl = await postsService.uploadMedia(mediaUri, "stories", facing === "front");
        setUploadMsg("Publicando...");
      }
      await api.post("/stories", { mediaUrl, caption, durationHours: duration });
      navigation.navigate("Tabs", { screen: "Feed" });
    } catch (e: any) {
      setUploadMsg("");
      setUploading(false);
    }
  };

  const resetEditor = () => {
    setMediaUri(null); setTextLayers([]); setSelectedId(null); setMode("select");
  };

  // ── RENDER: Seleção ────────────────────────────────────────────────────
  if (mode === "select") {
    return (
      <GestureHandlerRootView style={s.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={["#06010F", "#130730", "#010B18", "#06010F"]}
          locations={[0, 0.4, 0.75, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Orbs atmosféricos */}
        <View style={s.orb1} /><View style={s.orb2} /><View style={s.orb3} />

        {/* Fechar */}
        <TouchableOpacity
          style={[s.pill, { top: insets.top + 12, left: 16 }]}
          onPress={() => navigation.navigate("Tabs", { screen: "Feed" })}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* Hero */}
        <View style={[s.hero, { paddingTop: insets.top + 60 }]}>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>⚡ FLASH</Text>
          </View>
          <Text style={s.heroTitle}>Capture o momento,{"\n"}defina o tempo.</Text>
          <Text style={s.heroSub}>Conteúdo efêmero que desaparece quando você quiser</Text>

          {/* Seletor de duração */}
          <View style={s.durRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity
                key={d.hours}
                style={[s.durPill, duration === d.hours && s.durPillOn]}
                onPress={() => setDuration(d.hours)}
                activeOpacity={0.8}
              >
                <Text style={[s.durTxt, duration === d.hours && s.durTxtOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.durHint}>Flash some após {DURATIONS.find(d => d.hours === duration)?.label}</Text>
        </View>

        {/* Ações — zona do polegar */}
        <View style={[s.actionRow, { paddingBottom: insets.bottom + 32 }]}>
          <ActionCard icon="camera-outline"  label="Câmera"  accent="#7C3AED" onPress={openCamera} />
          <ActionCard icon="images-outline"  label="Galeria" accent="#06B6D4" onPress={pickFromGallery} />
          <ActionCard icon="text-outline"    label="Texto"   accent="#F43F5E" onPress={() => { setMediaUri(null); setMode("preview"); }} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // ── RENDER: Câmera ─────────────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <GestureHandlerRootView style={s.root}>
        <StatusBar hidden />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          enableTorch={torchOn && facing === "back"}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent", "transparent", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Topo */}
        <View style={[s.camTop, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={s.camPill} onPress={() => setMode("select")} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {facing === "back" && (
              <TouchableOpacity
                style={[s.camPill, torchOn && s.camPillOn]}
                onPress={() => setTorchOn(t => !t)}
                activeOpacity={0.8}
              >
                <Ionicons name={torchOn ? "flash" : "flash-off"} size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.camPill}
              onPress={() => { setFacing(f => f === "back" ? "front" : "back"); setTorchOn(false); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Base — zona do polegar */}
        <View style={[s.camBase, { paddingBottom: insets.bottom + 32 }]}>
          <TouchableOpacity style={s.camSide} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={24} color="#fff" />
            <Text style={s.camSideTxt}>Galeria</Text>
          </TouchableOpacity>

          {/* Shutter */}
          <TouchableOpacity style={s.shutter} onPress={takePicture} activeOpacity={0.9}>
            <View style={s.shutterOuter}>
              <View style={s.shutterInner} />
            </View>
          </TouchableOpacity>

          <View style={s.camSide} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // ── RENDER: Editor / Canvas ─────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar hidden />

      {/* ── Canvas — fundo ── */}
      {mediaUri ? (
        <View style={s.mediaBg}>
          <Image source={{ uri: mediaUri }} style={s.mediaImg} resizeMode="contain" />
        </View>
      ) : currentBg.type === "gradient" ? (
        <LinearGradient colors={currentBg.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: currentBg.color }]} />
      )}

      {/* ── Tap em área vazia → novo texto ── */}
      <TouchableWithoutFeedback
        onPress={() => {
          if (selectedId) { setSelectedId(null); return; }
          openNewText();
        }}
      >
        <View style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>

      {/* ── Camadas de texto ── */}
      {textLayers.map(layer => (
        <TextLayerView
          key={layer.id}
          layer={layer}
          isSelected={selectedId === layer.id}
          onSelect={() => setSelectedId(layer.id === selectedId ? null : layer.id)}
          onEdit={() => openEditText(layer)}
          onMirror={() => mirrorLayer(layer.id)}
        />
      ))}

      {/* ── Toolbar flutuante quando camada selecionada ── */}
      {selectedLayer && (
        <BlurView
          intensity={60}
          tint="dark"
          style={[s.floatToolbar, { top: insets.top + 60 }]}
        >
          <TouchableOpacity style={s.fToolBtn} onPress={() => openEditText(selectedLayer)} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={s.fToolDivider} />
          <TouchableOpacity style={s.fToolBtn} onPress={() => mirrorLayer(selectedLayer.id)} activeOpacity={0.8}>
            <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={s.fToolDivider} />
          <TouchableOpacity style={s.fToolBtn} onPress={() => deleteLayer(selectedLayer.id)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </BlurView>
      )}

      {/* ── Hint tap-to-edit ── */}
      {textLayers.length === 0 && (
        <View style={s.tapHint} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={18} color="rgba(255,255,255,0.4)" />
          <Text style={s.tapHintTxt}>Toque para adicionar texto</Text>
        </View>
      )}

      {/* ── Barra superior ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={s.editorPill}
          onPress={() => {
            if (mediaUri || textLayers.length > 0) { setDiscardModal(true); }
            else resetEditor();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {!mediaUri && (
            <TouchableOpacity
              style={s.editorPill}
              onPress={() => setBgIndex(i => (i + 1) % BACKGROUNDS.length)}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {/* Botão texto explícito também disponível */}
          <TouchableOpacity style={s.editorPill} onPress={openNewText} activeOpacity={0.8}>
            <Ionicons name="text-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Barra inferior — zona do polegar ── */}
      <View style={[s.botBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Seletor duração com blur */}
        <BlurView intensity={55} tint="dark" style={s.durBar}>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.hours}
              style={[s.durBarBtn, duration === d.hours && s.durBarBtnOn]}
              onPress={() => setDuration(d.hours)}
              activeOpacity={0.8}
            >
              <Text style={[s.durBarTxt, duration === d.hours && s.durBarTxtOn]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* Publicar — só aparece com conteúdo */}
        {(mediaUri || textLayers.length > 0) && (
          <TouchableOpacity
            style={[s.pubBtn, uploading && { opacity: 0.5 }]}
            onPress={handlePublish}
            disabled={uploading}
            activeOpacity={0.88}
          >
            {uploading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.pubTxt}>{uploadMsg || "Enviando..."}</Text>
              </>
            ) : (
              <>
                <Text style={s.pubTxt}>Publicar</Text>
                <Ionicons name="send" size={14} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Modal de texto — não afeta canvas ── */}
      <Modal
        visible={textModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => { Keyboard.dismiss(); setTextModal(false); }}
      >
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setTextModal(false); }}>
          <View style={s.txtModalBg}>
            <TouchableWithoutFeedback>
              <View style={s.txtSheet}>
                {/* Handle */}
                <View style={s.handle} />

                {/* Paleta de cores */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.colorRow}
                >
                  {TEXT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[s.colorDot, { backgroundColor: c }, editColor === c && s.colorDotOn]}
                      onPress={() => setEditColor(c)}
                    />
                  ))}
                </ScrollView>

                {/* Tamanho de fonte */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sizeRow}>
                  {FONT_SIZES.map(sz => (
                    <TouchableOpacity
                      key={sz}
                      style={[s.sizePill, editSize === sz && s.sizePillOn]}
                      onPress={() => setEditSize(sz)}
                    >
                      <Text style={[s.sizeTxt, editSize === sz && s.sizeTxtOn]}>{sz}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Estilos */}
                <View style={s.styleRow}>
                  <TouchableOpacity style={[s.styleBtn, editBold && s.styleBtnOn]} onPress={() => setEditBold(b => !b)} activeOpacity={0.8}>
                    <Text style={[{ color: "#fff", fontWeight: "800", fontSize: 14 }]}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.styleBtn, editItalic && s.styleBtnOn]} onPress={() => setEditItalic(i => !i)} activeOpacity={0.8}>
                    <Text style={[{ color: "#fff", fontStyle: "italic", fontSize: 14 }]}>I</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.styleBtn, editHL && s.styleBtnOn]} onPress={() => setEditHL(h => !h)} activeOpacity={0.8}>
                    <Ionicons name="square" size={13} color="#fff" />
                  </TouchableOpacity>

                  {/* Preview ao vivo */}
                  <View style={[s.previewBox, editHL && { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8 }]}>
                    <Text style={{
                      color:      editColor,
                      fontSize:   Math.min(editSize, 22),
                      fontWeight: editBold   ? "800" : "400",
                      fontStyle:  editItalic ? "italic" : "normal",
                    }}>Aa</Text>
                  </View>
                </View>

                {/* Input */}
                <TextInput
                  style={[s.txtInput, {
                    color:      editColor,
                    fontSize:   editSize > 36 ? 24 : editSize,
                    fontWeight: editBold   ? "800" : "400",
                    fontStyle:  editItalic ? "italic" : "normal",
                  }]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Digite seu texto..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  multiline
                  autoFocus
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={commitText}
                />

                {/* Botões de ação */}
                <View style={s.txtActions}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => { Keyboard.dismiss(); setTextModal(false); }} activeOpacity={0.8}>
                    <Text style={s.cancelTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.confirmBtn} onPress={commitText} activeOpacity={0.85}>
                    <Text style={s.confirmTxt}>
                      {editingLayer ? "Salvar" : "Adicionar"}
                    </Text>
                    <Ionicons name={editingLayer ? "checkmark" : "add"} size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal descarte ── */}
      <AppModal visible={discardModal} onClose={() => setDiscardModal(false)}>
        <View style={mod2.header}>
          <View style={[mod2.iconWrap, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </View>
          <Text style={mod2.title}>Descartar Flash?</Text>
          <Text style={mod2.sub}>Todo o progresso será perdido.</Text>
        </View>
        <View style={mod2.divider} />
        <TouchableOpacity style={mod2.action} onPress={() => { setDiscardModal(false); resetEditor(); }} activeOpacity={0.7}>
          <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>Descartar</Text>
        </TouchableOpacity>
        <View style={mod2.divider} />
        <TouchableOpacity style={mod2.action} onPress={() => setDiscardModal(false)} activeOpacity={0.7}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>Continuar editando</Text>
        </TouchableOpacity>
      </AppModal>
    </GestureHandlerRootView>
  );
}

// ─── ActionCard ───────────────────────────────────────────────────────────────
function ActionCard({ icon, label, accent, onPress }: {
  icon: any; label: string; accent: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={ac.wrap} onPress={onPress} activeOpacity={0.75}>
      <LinearGradient colors={[accent + "30", accent + "10"]} style={ac.grad}>
        <View style={[ac.ring, { borderColor: accent + "60" }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
      </LinearGradient>
      <Text style={ac.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  wrap:  { flex: 1, alignItems: "center", gap: 10, paddingVertical: 20 },
  grad:  { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ring:  { width: 60, height: 60, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.8)", letterSpacing: -0.1 },
});

// ─── Estilos modal interno ────────────────────────────────────────────────────
const mod2 = StyleSheet.create({
  header:  { alignItems: "center", paddingVertical: 22, paddingHorizontal: 20, gap: 6 },
  iconWrap:{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title:   { fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },
  sub:     { fontSize: 13, color: "rgba(255,255,255,0.45)" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)" },
  action:  { alignItems: "center", paddingVertical: 18 },
});

// ─── Styles principais ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // Orbs hero
  orb1: { position:"absolute", width:320, height:320, borderRadius:160, backgroundColor:"#7C3AED", opacity:0.14, top:-90, right:-90 },
  orb2: { position:"absolute", width:240, height:240, borderRadius:120, backgroundColor:"#06B6D4", opacity:0.09, top:160, left:-80 },
  orb3: { position:"absolute", width:200, height:200, borderRadius:100, backgroundColor:"#F43F5E", opacity:0.08, bottom:200, right:20 },

  // Hero select
  pill:     { position:"absolute", zIndex:20, width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.07)", alignItems:"center", justifyContent:"center", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.08)" },
  hero:     { flex:1, paddingHorizontal:28, gap:14, justifyContent:"center" },
  badge:    { alignSelf:"flex-start", backgroundColor:"rgba(124,58,237,0.18)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(124,58,237,0.4)", paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
  badgeTxt: { color:"#A78BFA", fontSize:10, fontWeight:"800", letterSpacing:2 },
  heroTitle:{ fontSize:28, fontWeight:"800", color:"#fff", lineHeight:36, letterSpacing:-0.5 },
  heroSub:  { fontSize:13, color:"rgba(255,255,255,0.35)", lineHeight:20 },
  durRow:   { flexDirection:"row", gap:8, marginTop:4 },
  durPill:  { paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:"rgba(255,255,255,0.06)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.07)" },
  durPillOn:{ backgroundColor:"rgba(124,58,237,0.28)", borderColor:"rgba(124,58,237,0.5)" },
  durTxt:   { color:"rgba(255,255,255,0.4)", fontSize:13, fontWeight:"600" },
  durTxtOn: { color:"#A78BFA", fontWeight:"800" },
  durHint:  { fontSize:12, color:"rgba(255,255,255,0.2)" },
  actionRow:{ flexDirection:"row", paddingHorizontal:12, paddingTop:16, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:"rgba(255,255,255,0.06)" },

  // Câmera
  camTop:     { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  camPill:    { width:42, height:42, borderRadius:21, backgroundColor:"rgba(0,0,0,0.5)", alignItems:"center", justifyContent:"center" },
  camPillOn:  { backgroundColor:"rgba(251,191,36,0.5)" },
  camBase:    { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:36, zIndex:10 },
  camSide:    { width:56, alignItems:"center", gap:5 },
  camSideTxt: { color:"rgba(255,255,255,0.65)", fontSize:10, fontWeight:"600" },
  shutter:    { alignItems:"center", justifyContent:"center" },
  shutterOuter:{ width:82, height:82, borderRadius:41, borderWidth:4, borderColor:"rgba(255,255,255,0.9)", alignItems:"center", justifyContent:"center" },
  shutterInner:{ width:66, height:66, borderRadius:33, backgroundColor:"#fff" },

  // Editor
  mediaBg:  { ...StyleSheet.absoluteFillObject, backgroundColor:"#000" },
  mediaImg: { width:"100%", height:"100%" },
  tapHint:  { position:"absolute", top:"48%", alignSelf:"center", flexDirection:"row", alignItems:"center", gap:8, zIndex:3, pointerEvents:"none" as any },
  tapHintTxt:{ color:"rgba(255,255,255,0.35)", fontSize:14, fontWeight:"500" },
  topBar:   { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  editorPill:{ width:38, height:38, borderRadius:19, backgroundColor:"rgba(0,0,0,0.55)", alignItems:"center", justifyContent:"center" },
  floatToolbar:{ position:"absolute", right:14, borderRadius:16, overflow:"hidden", zIndex:25 },
  fToolBtn: { width:40, height:40, alignItems:"center", justifyContent:"center" },
  fToolDivider:{ height:StyleSheet.hairlineWidth, backgroundColor:"rgba(255,255,255,0.12)", marginHorizontal:10 },
  botBar:   { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingTop:12, zIndex:10 },
  durBar:   { flexDirection:"row", borderRadius:22, overflow:"hidden", padding:3, gap:1 },
  durBarBtn:   { paddingHorizontal:11, paddingVertical:6, borderRadius:18 },
  durBarBtnOn: { backgroundColor:"rgba(124,58,237,0.7)" },
  durBarTxt:   { color:"rgba(255,255,255,0.4)", fontSize:11, fontWeight:"600" },
  durBarTxtOn: { color:"#fff", fontWeight:"800" },
  pubBtn:   { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#7C3AED", paddingHorizontal:22, paddingVertical:12, borderRadius:26, elevation:4 },
  pubTxt:   { color:"#fff", fontWeight:"700", fontSize:14 },

  // Modal texto
  txtModalBg: { flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.5)" },
  txtSheet:   { backgroundColor:"rgba(10,10,16,0.97)", borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:12, paddingBottom:32, gap:14 },
  handle:     { width:40, height:4, borderRadius:2, backgroundColor:"rgba(255,255,255,0.15)", alignSelf:"center", marginBottom:4 },
  colorRow:   { gap:8, paddingVertical:4 },
  colorDot:   { width:30, height:30, borderRadius:15 },
  colorDotOn: { borderWidth:3, borderColor:"#fff", transform:[{ scale:1.2 }] },
  sizeRow:    { gap:6, paddingVertical:2 },
  sizePill:   { paddingHorizontal:14, paddingVertical:6, borderRadius:14, backgroundColor:"rgba(255,255,255,0.07)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.08)" },
  sizePillOn: { backgroundColor:"rgba(124,58,237,0.4)", borderColor:"rgba(124,58,237,0.6)" },
  sizeTxt:    { color:"rgba(255,255,255,0.45)", fontSize:12, fontWeight:"600" },
  sizeTxtOn:  { color:"#A78BFA", fontWeight:"800" },
  styleRow:   { flexDirection:"row", alignItems:"center", gap:8 },
  styleBtn:   { width:36, height:36, borderRadius:10, backgroundColor:"rgba(255,255,255,0.08)", alignItems:"center", justifyContent:"center" },
  styleBtnOn: { backgroundColor:"rgba(124,58,237,0.5)" },
  previewBox: { marginLeft:"auto" as any, paddingHorizontal:10, paddingVertical:4 },
  txtInput:   { minHeight:60, textAlignVertical:"top", paddingVertical:4, borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:"rgba(255,255,255,0.08)" },
  txtActions: { flexDirection:"row", gap:10, marginTop:4 },
  cancelBtn:  { flex:1, paddingVertical:13, borderRadius:16, backgroundColor:"rgba(255,255,255,0.07)", alignItems:"center", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.08)" },
  cancelTxt:  { color:"rgba(255,255,255,0.5)", fontSize:14, fontWeight:"600" },
  confirmBtn: { flex:2, flexDirection:"row", gap:6, paddingVertical:13, borderRadius:16, backgroundColor:"#7C3AED", alignItems:"center", justifyContent:"center", elevation:3 },
  confirmTxt: { color:"#fff", fontSize:14, fontWeight:"700" },
});
