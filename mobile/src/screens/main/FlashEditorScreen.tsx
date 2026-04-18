/**
 * FlashEditorScreen v5
 * Gestos nativos: Pan + Pinch + Rotate por camada (Reanimated 4 + GH 2.28)
 * Toolbar inline · 22 fundos · Câmera frontal · Swipe down
 */
import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, StatusBar, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, ScrollView, Modal,
} from "react-native";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector, Gesture, GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useThemeStore } from "../../store/theme.store";
import { postsService } from "../../services/posts.service";
import { api } from "../../services/api";

const { width: SW, height: SH } = Dimensions.get("window");

// ── 22 fundos (3 sólidos + 19 gradientes) ────────────────────────────────────
const TEXT_COLORS = [
  "#FFFFFF","#000000","#F43F5E","#F97316",
  "#EAB308","#22C55E","#06B6D4","#8B5CF6",
  "#EC4899","#A78BFA","#34D399","#FB923C",
];

type BgItem = { type: "solid"; color: string } | { type: "gradient"; colors: [string,string] };
const BACKGROUNDS: BgItem[] = [
  { type:"solid",    color:"#000000" },
  { type:"solid",    color:"#FFFFFF" },
  { type:"solid",    color:"#6B7280" },
  { type:"gradient", colors:["#7C3AED","#06B6D4"] },
  { type:"gradient", colors:["#F43F5E","#F97316"] },
  { type:"gradient", colors:["#0EA5E9","#22C55E"] },
  { type:"gradient", colors:["#1E1040","#3B1F6E"] },
  { type:"gradient", colors:["#0F172A","#1E293B"] },
  { type:"gradient", colors:["#7C2D12","#C2410C"] },
  { type:"gradient", colors:["#064E3B","#065F46"] },
  { type:"gradient", colors:["#1E3A5F","#1D4ED8"] },
  { type:"gradient", colors:["#4C1D95","#BE185D"] },
  { type:"gradient", colors:["#134E4A","#0E7490"] },
  { type:"gradient", colors:["#1F2937","#374151"] },
  { type:"gradient", colors:["#7F1D1D","#991B1B"] },
  { type:"gradient", colors:["#14532D","#166534"] },
  { type:"gradient", colors:["#1E3A8A","#1D4ED8"] },
  { type:"gradient", colors:["#4A044E","#701A75"] },
  { type:"gradient", colors:["#0C4A6E","#0369A1"] },
  { type:"gradient", colors:["#422006","#78350F"] },
  { type:"gradient", colors:["#1C1917","#292524"] },
  { type:"gradient", colors:["#0A0A0F","#1A0A2E"] },
];

const DURATIONS = [
  { label:"1h",  hours:1  },
  { label:"6h",  hours:6  },
  { label:"12h", hours:12 },
  { label:"24h", hours:24 },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TextLayer {
  id:        string;
  text:      string;
  color:     string;
  size:      number;
  bold:      boolean;
  highlight: boolean; // caixa de destaque
  mirrored:  boolean;
}

type EditorMode = "select" | "camera" | "preview";

// ─────────────────────────────────────────────────────────────────────────────
// Camada de texto com gestos Pan + Pinch + Rotate (Reanimated 4)
// ─────────────────────────────────────────────────────────────────────────────
function TextLayerView({
  layer, isSelected, onSelect, onUpdate,
}: {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<TextLayer>) => void;
}) {
  // Posição, escala e rotação como shared values
  const tx    = useSharedValue(SW / 2 - 60);
  const ty    = useSharedValue(SH / 2 - 20);
  const scale = useSharedValue(1);
  const rot   = useSharedValue(0);

  // Salvamos o estado entre gestos
  const savedTx    = useSharedValue(SW / 2 - 60);
  const savedTy    = useSharedValue(SH / 2 - 20);
  const savedScale = useSharedValue(1);
  const savedRot   = useSharedValue(0);

  // Pan
  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate(e => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // Pinch
  const pinch = Gesture.Pinch()
    .onStart(() => { savedScale.value = scale.value; })
    .onUpdate(e => { scale.value = Math.max(0.4, Math.min(4, savedScale.value * e.scale)); })
    .onEnd(() => { savedScale.value = scale.value; });

  // Rotate
  const rotate = Gesture.Rotation()
    .onStart(() => { savedRot.value = rot.value; })
    .onUpdate(e => { rot.value = savedRot.value + e.rotation; })
    .onEnd(() => { savedRot.value = rot.value; });

  // Tap para selecionar
  const tap = Gesture.Tap()
    .onEnd(() => { runOnJS(onSelect)(); });

  const composed = Gesture.Simultaneous(
    Gesture.Simultaneous(pan, pinch),
    Gesture.Simultaneous(rotate, tap),
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rot.value}rad` },
      { scaleX: layer.mirrored ? -1 : 1 },
    ],
  }));

  const textStyle = {
    color:      layer.color,
    fontSize:   layer.size,
    fontWeight: layer.bold ? ("800" as const) : ("400" as const),
    backgroundColor: layer.highlight ? "rgba(0,0,0,0.55)" : "transparent",
    paddingHorizontal: layer.highlight ? 6 : 0,
    paddingVertical:   layer.highlight ? 2 : 0,
    borderRadius:      layer.highlight ? 4 : 0,
    textShadowColor:  layer.highlight ? "transparent" : "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: layer.highlight ? 0 : 5,
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[tl.wrap, animStyle, isSelected && tl.selected]}>
        <Text style={textStyle}>{layer.text}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const tl = StyleSheet.create({
  wrap:     { position:"absolute", zIndex:20, padding:8 },
  selected: { borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.7)", borderRadius:6, borderStyle:"dashed" },
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function FlashEditorScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode,      setMode]      = useState<EditorMode>("select");
  const [mediaUri,  setMediaUri]  = useState<string | null>(null);
  const [bgIndex,   setBgIndex]   = useState(3);
  const [facing,    setFacing]    = useState<"front"|"back">("front");
  const [torchOn,   setTorchOn]   = useState(false);
  const [duration,  setDuration]  = useState(24);
  const cameraRef = useRef<CameraView>(null);

  const [textLayers,      setTextLayers]      = useState<TextLayer[]>([]);
  const [selectedId,      setSelectedId]      = useState<string|null>(null);
  const [editingText,     setEditingText]     = useState(false);
  const [editDraft,       setEditDraft]       = useState("");
  const [editColor,       setEditColor]       = useState("#FFFFFF");
  const [editSize,        setEditSize]        = useState(24);
  const [editBold,        setEditBold]        = useState(false);
  const [editHighlight,   setEditHighlight]   = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState("");

  const selectedLayer = textLayers.find(l => l.id === selectedId);

  // ── Galeria ──────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: false,   // sem crop nativo
      quality: 0.92,
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

  // ── Texto ────────────────────────────────────────────────────────────────
  const openTextEditor = () => {
    setEditDraft("");
    setEditColor("#FFFFFF");
    setEditSize(24);
    setEditBold(false);
    setEditHighlight(false);
    setSelectedId(null);
    setEditingText(true);
  };

  const commitText = () => {
    if (!editDraft.trim()) { setEditingText(false); return; }
    const layer: TextLayer = {
      id:        Date.now().toString(),
      text:      editDraft.trim(),
      color:     editColor,
      size:      editSize,
      bold:      editBold,
      highlight: editHighlight,
      mirrored:  false,
    };
    setTextLayers(prev => [...prev, layer]);
    setEditDraft(""); setEditingText(false);
    setSelectedId(layer.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setTextLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null);
  };

  const toggleMirror = () => {
    if (!selectedId) return;
    setTextLayers(prev => prev.map(l => l.id === selectedId ? { ...l, mirrored: !l.mirrored } : l));
  };

  const toggleHighlight = () => {
    if (!selectedId) return;
    setTextLayers(prev => prev.map(l => l.id === selectedId ? { ...l, highlight: !l.highlight } : l));
  };

  // ── Publicar ─────────────────────────────────────────────────────────────
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
    } finally { setUploading(false); setUploadProgress(""); }
  };

  const confirmDiscard = () => {
    if (mediaUri || textLayers.length > 0) {
      Alert.alert("Descartar Flash?", "Todo o progresso será perdido.", [
        { text: "Continuar editando", style:"cancel" },
        { text:"Descartar", style:"destructive", onPress: resetEditor },
      ]);
    } else { resetEditor(); }
  };

  const resetEditor = () => {
    setMediaUri(null); setTextLayers([]); setSelectedId(null); setMode("select");
  };

  const currentBg = BACKGROUNDS[bgIndex % BACKGROUNDS.length];

  // ── RENDER: Seleção ────────────────────────────────────────────────────
  if (mode === "select") {
    return (
      <GestureHandlerRootView style={s.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={["#0A0A0F","#1A0A2E","#0A1628","#0A0A0F"]} locations={[0,0.35,0.7,1]} style={StyleSheet.absoluteFillObject} />
        <View style={s.orb1} /><View style={s.orb2} /><View style={s.orb3} />

        <TouchableOpacity style={[s.iconBtn, { top:insets.top+12, left:16 }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={[s.heroWrap, { paddingTop:insets.top+60 }]}>
          <View style={s.heroBadge}><Text style={s.heroBadgeText}>⚡ FLASH</Text></View>
          <Text style={s.heroTitle}>Capture o momento,{"\n"}defina o tempo.</Text>
          <Text style={s.heroSub}>Conteúdo efêmero que some quando você quiser</Text>
          <View style={s.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d.hours} style={[s.durationBtn, duration===d.hours && s.durationBtnActive]} onPress={() => setDuration(d.hours)} activeOpacity={0.8}>
                <Text style={[s.durationLabel, duration===d.hours && s.durationLabelActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.durationHint}>Seu Flash some após {DURATIONS.find(d=>d.hours===duration)?.label}</Text>
        </View>

        <View style={[s.actionGrid, { paddingBottom:insets.bottom+32 }]}>
          <HeroCard icon="camera" label="Câmera"  sub="Foto agora"    accent="#7C3AED" onPress={openCamera} />
          <HeroCard icon="images" label="Galeria" sub="Escolher foto" accent="#0EA5E9" onPress={pickFromGallery} />
          <HeroCard icon="text"   label="Texto"   sub="Só palavras"   accent="#F43F5E" onPress={() => { setMediaUri(null); setMode("preview"); }} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // ── RENDER: Câmera ─────────────────────────────────────────────────────
  if (mode === "camera") {
    return (
      <GestureHandlerRootView style={s.root}>
        <StatusBar hidden />
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing} enableTorch={torchOn && facing==="back"} />
        <LinearGradient colors={["rgba(0,0,0,0.5)","transparent","transparent","rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

        <View style={[s.camTop, { paddingTop:insets.top+10 }]}>
          <TouchableOpacity style={s.camBtn} onPress={() => setMode("select")} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection:"row", gap:10 }}>
            {facing==="back" && (
              <TouchableOpacity style={[s.camBtn, torchOn && s.camBtnActive]} onPress={() => setTorchOn(t=>!t)} activeOpacity={0.8}>
                <Ionicons name={torchOn ? "flash" : "flash-off"} size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.camBtn} onPress={() => { setFacing(f=>f==="back"?"front":"back"); setTorchOn(false); }} activeOpacity={0.8}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.camBottom, { paddingBottom:insets.bottom+28 }]}>
          <TouchableOpacity style={s.galleryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.shutter} onPress={takePicture} activeOpacity={0.9}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <View style={s.galleryBtn} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // ── RENDER: Editor ─────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar hidden />

      {/* Fundo */}
      {mediaUri ? (
        <Image source={{ uri:mediaUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
      ) : currentBg.type==="gradient" ? (
        <LinearGradient colors={currentBg.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor:currentBg.color }]} />
      )}
      <View style={s.previewOverlay} pointerEvents="none" />

      {/* Camadas de texto com gestos */}
      {textLayers.map(layer => (
        <TextLayerView
          key={layer.id}
          layer={layer}
          isSelected={selectedId===layer.id}
          onSelect={() => setSelectedId(layer.id===selectedId ? null : layer.id)}
          onUpdate={patch => setTextLayers(prev => prev.map(l => l.id===layer.id ? { ...l, ...patch } : l))}
        />
      ))}

      {/* Toolbar de camada selecionada */}
      {selectedLayer && !editingText && (
        <View style={[s.toolbar, { top:insets.top+56 }]}>
          <TouchableOpacity style={s.toolBtn} onPress={toggleHighlight} activeOpacity={0.8}>
            <Ionicons name={selectedLayer.highlight ? "square" : "square-outline"} size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={toggleMirror} activeOpacity={0.8}>
            <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.toolBtn, { backgroundColor:"rgba(239,68,68,0.6)" }]} onPress={removeSelected} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de entrada de texto */}
      {editingText && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFillObject} behavior={Platform.OS==="ios"?"padding":"height"} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setEditingText(false); }}>
            <View style={s.textModalBg}>
              <TouchableWithoutFeedback>
                <View style={s.textModal}>
                  {/* Cores */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
                    {TEXT_COLORS.map(c => (
                      <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor:c }, editColor===c && s.colorDotActive]} onPress={() => setEditColor(c)} />
                    ))}
                  </ScrollView>

                  {/* Controles */}
                  <View style={s.textControls}>
                    <TouchableOpacity style={[s.textCtrlBtn, editBold && s.textCtrlBtnActive]} onPress={() => setEditBold(b=>!b)}>
                      <Text style={{ color:"#fff", fontWeight:"800", fontSize:14 }}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.textCtrlBtn, editHighlight && s.textCtrlBtnActive]} onPress={() => setEditHighlight(h=>!h)}>
                      <Ionicons name="square" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.textCtrlBtn} onPress={() => setEditSize(sz=>Math.max(14,sz-4))}>
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <View style={s.sizeLabel}><Text style={{ color:"rgba(255,255,255,0.7)", fontSize:12 }}>{editSize}</Text></View>
                    <TouchableOpacity style={s.textCtrlBtn} onPress={() => setEditSize(sz=>Math.min(52,sz+4))}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[s.textInput, { color:editColor, fontSize:editSize, fontWeight:editBold?"800":"400" }]}
                    value={editDraft} onChangeText={setEditDraft}
                    placeholder="Digite algo..." placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline autoFocus returnKeyType="done" blurOnSubmit onSubmitEditing={commitText}
                  />
                  <TouchableOpacity style={s.addBtn} onPress={commitText} activeOpacity={0.85}>
                    <Text style={s.addBtnLabel}>Adicionar texto</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* Barra superior */}
      <View style={[s.topBar, { paddingTop:insets.top+10 }]}>
        <TouchableOpacity style={s.editorBtn} onPress={confirmDiscard} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection:"row", gap:8 }}>
          {!mediaUri && (
            <TouchableOpacity style={s.editorBtn} onPress={() => setBgIndex(i=>(i+1)%BACKGROUNDS.length)} activeOpacity={0.8}>
              <Ionicons name="color-palette-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.editorBtn} onPress={openTextEditor} activeOpacity={0.8}>
            <Ionicons name="text" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra inferior */}
      <View style={[s.bottomBar, { paddingBottom:insets.bottom+20 }]}>
        {/* Seletor de duração */}
        <View style={s.durationMini}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d.hours} style={[s.durationMiniBtn, duration===d.hours && s.durationMiniBtnActive]} onPress={() => setDuration(d.hours)} activeOpacity={0.8}>
              <Text style={[s.durationMiniLabel, duration===d.hours && s.durationMiniLabelActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Publicar — aparece só com conteúdo */}
        {(mediaUri || textLayers.length > 0) && (
          <TouchableOpacity style={[s.publishBtn, uploading && { opacity:0.55 }]} onPress={handlePublish} disabled={uploading} activeOpacity={0.88}>
            {uploading
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.publishLabel}>{uploadProgress||"Enviando..."}</Text></>
              : <><Text style={s.publishLabel}>Publicar</Text><Ionicons name="send" size={15} color="#fff" /></>
            }
          </TouchableOpacity>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ── HeroCard ──────────────────────────────────────────────────────────────────
function HeroCard({ icon, label, sub, accent, onPress }: { icon:any; label:string; sub:string; accent:string; onPress:()=>void }) {
  return (
    <TouchableOpacity style={hc.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[hc.iconRing, { borderColor:accent+"55" }]}>
        <View style={[hc.iconFill, { backgroundColor:accent+"22" }]}>
          <Ionicons name={icon} size={24} color={accent} />
        </View>
      </View>
      <Text style={hc.label}>{label}</Text>
      <Text style={hc.sub}>{sub}</Text>
    </TouchableOpacity>
  );
}
const hc = StyleSheet.create({
  card:     { flex:1, alignItems:"center", gap:10, paddingVertical:20, paddingHorizontal:8 },
  iconRing: { width:60, height:60, borderRadius:30, borderWidth:1, alignItems:"center", justifyContent:"center" },
  iconFill: { width:52, height:52, borderRadius:26, alignItems:"center", justifyContent:"center" },
  label:    { fontSize:13, fontWeight:"700", color:"#fff", letterSpacing:0.2 },
  sub:      { fontSize:11, color:"rgba(255,255,255,0.45)", textAlign:"center" },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:"#000" },
  orb1: { position:"absolute", width:280, height:280, borderRadius:140, backgroundColor:"#7C3AED", opacity:0.18, top:-60, right:-80 },
  orb2: { position:"absolute", width:200, height:200, borderRadius:100, backgroundColor:"#06B6D4", opacity:0.12, top:120, left:-60 },
  orb3: { position:"absolute", width:160, height:160, borderRadius:80,  backgroundColor:"#F43F5E", opacity:0.10, bottom:160, right:20 },
  iconBtn:      { position:"absolute", zIndex:20, width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.08)", alignItems:"center", justifyContent:"center" },
  heroWrap:     { flex:1, paddingHorizontal:28, gap:16 },
  heroBadge:    { flexDirection:"row", alignSelf:"flex-start", backgroundColor:"rgba(124,58,237,0.25)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(124,58,237,0.5)", paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
  heroBadgeText:{ color:"#A78BFA", fontSize:11, fontWeight:"800", letterSpacing:1.5 },
  heroTitle:    { fontSize:30, fontWeight:"800", color:"#fff", lineHeight:38, letterSpacing:-0.5 },
  heroSub:      { fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:20 },
  durationRow:  { flexDirection:"row", gap:8, marginTop:8 },
  durationBtn:  { paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:"rgba(255,255,255,0.08)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.1)" },
  durationBtnActive:  { backgroundColor:"rgba(124,58,237,0.35)", borderColor:"#7C3AED" },
  durationLabel:      { color:"rgba(255,255,255,0.5)", fontSize:13, fontWeight:"600" },
  durationLabelActive:{ color:"#A78BFA", fontWeight:"800" },
  durationHint: { fontSize:12, color:"rgba(255,255,255,0.3)" },
  actionGrid:   { flexDirection:"row", paddingHorizontal:16, paddingTop:8, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:"rgba(255,255,255,0.08)" },
  camTop:       { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  camBtn:       { width:38, height:38, borderRadius:19, backgroundColor:"rgba(0,0,0,0.45)", alignItems:"center", justifyContent:"center" },
  camBtnActive: { backgroundColor:"rgba(251,191,36,0.5)" },
  camBottom:    { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:40, zIndex:10 },
  galleryBtn:   { width:42, height:42, borderRadius:10, backgroundColor:"rgba(255,255,255,0.12)", alignItems:"center", justifyContent:"center" },
  shutter:      { width:74, height:74, borderRadius:37, borderWidth:4, borderColor:"#fff", alignItems:"center", justifyContent:"center" },
  shutterInner: { width:58, height:58, borderRadius:29, backgroundColor:"#fff" },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.05)" },
  topBar:       { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  editorBtn:    { width:36, height:36, borderRadius:18, backgroundColor:"rgba(0,0,0,0.5)", alignItems:"center", justifyContent:"center" },
  toolbar:      { position:"absolute", right:16, flexDirection:"column", gap:8, zIndex:25 },
  toolBtn:      { width:34, height:34, borderRadius:17, backgroundColor:"rgba(0,0,0,0.55)", alignItems:"center", justifyContent:"center" },
  bottomBar:    { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingTop:12, zIndex:10 },
  durationMini:         { flexDirection:"row", gap:4, backgroundColor:"rgba(0,0,0,0.45)", borderRadius:20, padding:3 },
  durationMiniBtn:      { paddingHorizontal:10, paddingVertical:5, borderRadius:16 },
  durationMiniBtnActive:{ backgroundColor:"rgba(124,58,237,0.7)" },
  durationMiniLabel:    { color:"rgba(255,255,255,0.5)", fontSize:11, fontWeight:"600" },
  durationMiniLabelActive:{ color:"#fff", fontWeight:"800" },
  publishBtn:   { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#7C3AED", paddingHorizontal:20, paddingVertical:11, borderRadius:24 },
  publishLabel: { color:"#fff", fontWeight:"700", fontSize:14 },
  textModalBg:  { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"flex-end" },
  textModal:    { backgroundColor:"rgba(15,15,20,0.98)", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, gap:14 },
  colorRow:     { gap:8, paddingVertical:2 },
  colorDot:     { width:28, height:28, borderRadius:14 },
  colorDotActive:{ borderWidth:3, borderColor:"#fff", transform:[{ scale:1.18 }] },
  textControls: { flexDirection:"row", alignItems:"center", gap:8 },
  textCtrlBtn:  { width:34, height:34, borderRadius:10, backgroundColor:"rgba(255,255,255,0.1)", alignItems:"center", justifyContent:"center" },
  textCtrlBtnActive:{ backgroundColor:"rgba(124,58,237,0.6)" },
  sizeLabel:    { paddingHorizontal:8 },
  textInput:    { minHeight:56, textAlignVertical:"top", paddingVertical:4 },
  addBtn:       { backgroundColor:"#7C3AED", borderRadius:14, paddingVertical:12, alignItems:"center" },
  addBtnLabel:  { color:"#fff", fontWeight:"700", fontSize:14 },
});
