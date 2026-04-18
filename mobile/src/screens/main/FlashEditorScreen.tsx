/**
 * FlashEditorScreen v6
 * Preview sem crop · Galeria com permissão · UI next-gen
 * Gestos Pan+Pinch+Rotate (Reanimated 4) · 22 fundos · Câmera frontal
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, StatusBar, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, ScrollView, Modal, BackHandler,
} from "react-native";
import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import * as NavigationBar from "expo-navigation-bar";
import { useThemeStore } from "../../store/theme.store";
import { postsService } from "../../services/posts.service";
import { api } from "../../services/api";

const { width: SW, height: SH } = Dimensions.get("window");

const TEXT_COLORS = [
  "#FFFFFF","#000000","#F43F5E","#F97316","#EAB308","#22C55E",
  "#06B6D4","#8B5CF6","#EC4899","#A78BFA","#34D399","#FB923C",
];

type BgItem = { type:"solid"; color:string } | { type:"gradient"; colors:[string,string] };
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

interface TextLayer {
  id:string; text:string; color:string; size:number;
  bold:boolean; highlight:boolean; mirrored:boolean;
}

type EditorMode = "select" | "camera" | "preview";

// ─── Camada de texto com gestos ───────────────────────────────────────────────
function TextLayerView({ layer, isSelected, onSelect }: {
  layer:TextLayer; isSelected:boolean; onSelect:()=>void;
}) {
  const tx = useSharedValue(SW/2 - 60);
  const ty = useSharedValue(SH/2 - 20);
  const sc = useSharedValue(1);
  const ro = useSharedValue(0);
  const stx = useSharedValue(SW/2 - 60);
  const sty = useSharedValue(SH/2 - 20);
  const ssc = useSharedValue(1);
  const sro = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => { stx.value = tx.value; sty.value = ty.value; })
    .onUpdate(e => { tx.value = stx.value + e.translationX; ty.value = sty.value + e.translationY; })
    .onEnd(() => { stx.value = tx.value; sty.value = ty.value; });

  const pinch = Gesture.Pinch()
    .onStart(() => { ssc.value = sc.value; })
    .onUpdate(e => { sc.value = Math.max(0.4, Math.min(4, ssc.value * e.scale)); })
    .onEnd(() => { ssc.value = sc.value; });

  const rotate = Gesture.Rotation()
    .onStart(() => { sro.value = ro.value; })
    .onUpdate(e => { ro.value = sro.value + e.rotation; })
    .onEnd(() => { sro.value = ro.value; });

  const tap = Gesture.Tap().onEnd(() => { runOnJS(onSelect)(); });

  const composed = Gesture.Simultaneous(
    Gesture.Simultaneous(pan, pinch),
    Gesture.Simultaneous(rotate, tap),
  );

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value }, { translateY: ty.value },
      { scale: sc.value }, { rotateZ: `${ro.value}rad` },
      { scaleX: layer.mirrored ? -1 : 1 },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[tl.wrap, aStyle, isSelected && tl.selected]}>
        <Text style={{
          color: layer.color, fontSize: layer.size,
          fontWeight: layer.bold ? "800" : "400",
          backgroundColor: layer.highlight ? "rgba(0,0,0,0.6)" : "transparent",
          paddingHorizontal: layer.highlight ? 8 : 0,
          paddingVertical:   layer.highlight ? 3 : 0,
          borderRadius:      layer.highlight ? 6 : 0,
          textShadowColor:   layer.highlight ? "transparent" : "rgba(0,0,0,0.7)",
          textShadowOffset:  { width:0, height:1 },
          textShadowRadius:  layer.highlight ? 0 : 6,
        }}>{layer.text}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const tl = StyleSheet.create({
  wrap:     { position:"absolute", zIndex:20, padding:8 },
  selected: { borderWidth:1, borderColor:"rgba(255,255,255,0.6)", borderRadius:8, borderStyle:"dashed" },
});

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlashEditorScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [permission,        requestPermission]    = useCameraPermissions();
  const [mediaPermission,   requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  useEffect(() => {
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync("visible").catch(() => {});
      NavigationBar.setBackgroundColorAsync(theme.background).catch(() => {});
    };
  }, []);

  const [mode,     setMode]     = useState<EditorMode>("select");
  const [mediaUri, setMediaUri] = useState<string|null>(null);
  const [bgIndex,  setBgIndex]  = useState(3);
  const [facing,   setFacing]   = useState<"front"|"back">("front");
  const [torchOn,  setTorchOn]  = useState(false);
  const [duration, setDuration] = useState(24);
  const cameraRef = useRef<CameraView>(null);

  const [textLayers,    setTextLayers]    = useState<TextLayer[]>([]);
  const [selectedId,    setSelectedId]    = useState<string|null>(null);
  const [editingText,   setEditingText]   = useState(false);
  const [editDraft,     setEditDraft]     = useState("");
  const [editColor,     setEditColor]     = useState("#FFFFFF");
  const [editSize,      setEditSize]      = useState(24);
  const [editBold,      setEditBold]      = useState(false);
  const [editHighlight, setEditHighlight] = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [discardModal,  setDiscardModal]  = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState("");

  const selectedLayer = textLayers.find(l => l.id === selectedId);

  // ── Galeria — pede permissão corretamente ───────────────────────────────
  const pickFromGallery = async () => {
    // Pede permissão se necessário
    if (!mediaPermission?.granted) {
      const { granted } = await requestMediaPermission();
      if (!granted) {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria de fotos.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaType.Images,
      allowsEditing: false,   // sem crop nativo — controlamos no app
      quality:       1,       // qualidade máxima — o manipulator vai comprimir
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo?.uri) { setMediaUri(photo.uri); setTorchOn(false); setMode("preview"); }
    } catch { Alert.alert("Erro", "Não foi possível tirar a foto."); }
  };

  // ── Texto ────────────────────────────────────────────────────────────────
  const openTextEditor = () => {
    setEditDraft(""); setEditColor("#FFFFFF"); setEditSize(24);
    setEditBold(false); setEditHighlight(false); setSelectedId(null);
    setEditingText(true);
  };

  const commitText = () => {
    if (!editDraft.trim()) { setEditingText(false); return; }
    const layer: TextLayer = {
      id: Date.now().toString(), text: editDraft.trim(), color: editColor,
      size: editSize, bold: editBold, highlight: editHighlight, mirrored: false,
    };
    setTextLayers(prev => [...prev, layer]);
    setEditDraft(""); setEditingText(false); setSelectedId(layer.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setTextLayers(prev => prev.filter(l => l.id !== selectedId));
    setSelectedId(null);
  };

  const toggleMirror    = () => { if (selectedId) setTextLayers(prev => prev.map(l => l.id===selectedId ? {...l, mirrored:!l.mirrored} : l)); };
  const toggleHighlight = () => { if (selectedId) setTextLayers(prev => prev.map(l => l.id===selectedId ? {...l, highlight:!l.highlight} : l)); };

  // ── Publicar ─────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    const caption = textLayers.map(l => l.text).join(" · ") || undefined;
    if (!mediaUri && !caption) {
      Alert.alert("Flash vazio", "Adicione uma imagem ou texto antes de publicar."); return;
    }
    setUploading(true);
    try {
      let mediaUrl = "";
      if (mediaUri) {
        setUploadMsg("Comprimindo...");
        mediaUrl = await postsService.uploadMedia(mediaUri, "stories", facing === "front");
        setUploadMsg("Publicando...");
      }
      await api.post("/stories", { mediaUrl, caption, durationHours: duration });
      Alert.alert("Flash publicado! ⚡", `Some em ${duration}h.`, [
        { text: "OK", onPress: () => navigation.navigate("Tabs", { screen: "Feed" }) },
      ]);
    } catch (e: any) {
      Alert.alert("Erro ao publicar", e?.response?.data?.message || e?.message || "Tente novamente.");
    } finally { setUploading(false); setUploadMsg(""); }
  };

  const confirmDiscard = () => {
    if (mediaUri || textLayers.length > 0) {
      setDiscardModal(true);
    } else resetEditor();
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
        <LinearGradient colors={["#080810","#150828","#081520","#080810"]} locations={[0,0.35,0.7,1]} style={StyleSheet.absoluteFillObject} />
        {/* Orbs */}
        <View style={s.orb1} /><View style={s.orb2} /><View style={s.orb3} />

        <TouchableOpacity style={[s.iconBtn, { top:insets.top+12, left:16 }]} onPress={() => navigation.navigate("Tabs", { screen:"Feed" })} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        {/* Hero */}
        <View style={[s.heroWrap, { paddingTop:insets.top+56 }]}>
          <View style={s.heroBadge}><Text style={s.heroBadgeText}>⚡ FLASH</Text></View>
          <Text style={s.heroTitle}>Capture o momento,{"\n"}defina o tempo.</Text>
          <Text style={s.heroSub}>Conteúdo efêmero que some quando você quiser</Text>

          {/* Seletor de duração */}
          <View style={s.durationRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d.hours} style={[s.durBtn, duration===d.hours && s.durBtnOn]} onPress={() => setDuration(d.hours)} activeOpacity={0.8}>
                <Text style={[s.durLabel, duration===d.hours && s.durLabelOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.durHint}>Some após {DURATIONS.find(d=>d.hours===duration)?.label}</Text>
        </View>

        {/* Action cards */}
        <View style={[s.actionGrid, { paddingBottom:insets.bottom+28 }]}>
          <HeroCard icon="camera" label="Câmera"  sub="Foto agora"    accent="#7C3AED" onPress={openCamera} />
          <HeroCard icon="images" label="Galeria" sub="Escolher foto" accent="#06B6D4" onPress={pickFromGallery} />
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
        <LinearGradient colors={["rgba(0,0,0,0.55)","transparent","transparent","rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

        {/* Topo */}
        <View style={[s.camTop, { paddingTop:insets.top+12 }]}>
          <TouchableOpacity style={s.camBtn} onPress={() => setMode("select")} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection:"row", gap:10 }}>
            {facing==="back" && (
              <TouchableOpacity style={[s.camBtn, torchOn && s.camBtnOn]} onPress={() => setTorchOn(t=>!t)} activeOpacity={0.8}>
                <Ionicons name={torchOn ? "flash" : "flash-off"} size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.camBtn} onPress={() => { setFacing(f=>f==="back"?"front":"back"); setTorchOn(false); }} activeOpacity={0.8}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Base */}
        <View style={[s.camBase, { paddingBottom:insets.bottom+32 }]}>
          <TouchableOpacity style={s.camSideBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={s.camSideLabel}>Galeria</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.shutter} onPress={takePicture} activeOpacity={0.9}>
            <View style={s.shutterRing}>
              <View style={s.shutterCore} />
            </View>
          </TouchableOpacity>

          <View style={s.camSideBtn} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // ── RENDER: Editor ─────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar hidden />

      {/* Fundo — imagem com aspect ratio correto */}
      {mediaUri ? (
        <View style={s.mediaBg}>
          <Image
            source={{ uri:mediaUri }}
            style={s.mediaImg}
            resizeMode="contain"
          />
        </View>
      ) : currentBg.type==="gradient" ? (
        <LinearGradient colors={currentBg.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor:currentBg.color }]} />
      )}

      {/* Overlay sutil */}
      <View style={s.overlay} pointerEvents="none" />

      {/* Camadas de texto */}
      {textLayers.map(layer => (
        <TextLayerView
          key={layer.id}
          layer={layer}
          isSelected={selectedId===layer.id}
          onSelect={() => setSelectedId(layer.id===selectedId ? null : layer.id)}
        />
      ))}

      {/* Toolbar da camada selecionada */}
      {selectedLayer && !editingText && (
        <BlurView intensity={40} tint="dark" style={[s.toolbar, { top:insets.top+56 }]}>
          <TouchableOpacity style={s.toolBtn} onPress={toggleHighlight} activeOpacity={0.8}>
            <Ionicons name={selectedLayer.highlight ? "square" : "square-outline"} size={15} color="#fff" />
          </TouchableOpacity>
          <View style={s.toolDivider} />
          <TouchableOpacity style={s.toolBtn} onPress={toggleMirror} activeOpacity={0.8}>
            <Ionicons name="swap-horizontal-outline" size={15} color="#fff" />
          </TouchableOpacity>
          <View style={s.toolDivider} />
          <TouchableOpacity style={s.toolBtn} onPress={removeSelected} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        </BlurView>
      )}

      {/* Input de texto */}
      {editingText && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFillObject} behavior={Platform.OS==="ios"?"padding":"height"} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setEditingText(false); }}>
            <View style={s.textBg}>
              <TouchableWithoutFeedback>
                <View style={s.textSheet}>
                  {/* Paleta */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
                    {TEXT_COLORS.map(c => (
                      <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor:c }, editColor===c && s.colorDotOn]} onPress={() => setEditColor(c)} />
                    ))}
                  </ScrollView>

                  {/* Controles */}
                  <View style={s.textCtrl}>
                    <TouchableOpacity style={[s.ctrlBtn, editBold && s.ctrlBtnOn]} onPress={() => setEditBold(b=>!b)}>
                      <Text style={{ color:"#fff", fontWeight:"800", fontSize:14 }}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.ctrlBtn, editHighlight && s.ctrlBtnOn]} onPress={() => setEditHighlight(h=>!h)}>
                      <Ionicons name="square" size={13} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.ctrlBtn} onPress={() => setEditSize(sz=>Math.max(14,sz-4))}>
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={s.sizeNum}>{editSize}</Text>
                    <TouchableOpacity style={s.ctrlBtn} onPress={() => setEditSize(sz=>Math.min(52,sz+4))}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[s.textIn, { color:editColor, fontSize:editSize, fontWeight:editBold?"800":"400" }]}
                    value={editDraft} onChangeText={setEditDraft}
                    placeholder="Digite algo..." placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline autoFocus returnKeyType="done" blurOnSubmit onSubmitEditing={commitText}
                  />

                  <TouchableOpacity style={s.addTextBtn} onPress={commitText} activeOpacity={0.85}>
                    <Text style={s.addTextLabel}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* Modal de descarte next-gen */}
      <Modal visible={discardModal} transparent animationType="none" statusBarTranslucent onRequestClose={() => setDiscardModal(false)}>
        <TouchableWithoutFeedback onPress={() => setDiscardModal(false)}>
          <View style={s.modalBg}>
            <TouchableWithoutFeedback>
              <View style={s.modalSheet}>
                <BlurView intensity={80} tint="dark" style={s.modalBlur}>
                  <View style={s.modalHeader}>
                    <View style={[s.modalIcon, { backgroundColor:"rgba(239,68,68,0.15)" }]}>
                      <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </View>
                    <Text style={s.modalTitle}>Descartar Flash?</Text>
                    <Text style={s.modalSub}>Todo o progresso será perdido.</Text>
                  </View>
                  <View style={s.modalDivider} />
                  <TouchableOpacity style={[s.modalAction, { justifyContent:"center" }]} onPress={() => { setDiscardModal(false); resetEditor(); }} activeOpacity={0.7}>
                    <Text style={{ color:"#EF4444", fontSize:16, fontWeight:"700" }}>Descartar</Text>
                  </TouchableOpacity>
                  <View style={s.modalDivider} />
                  <TouchableOpacity style={[s.modalAction, { justifyContent:"center" }]} onPress={() => setDiscardModal(false)} activeOpacity={0.7}>
                    <Text style={{ color:"rgba(255,255,255,0.5)", fontSize:15 }}>Continuar editando</Text>
                  </TouchableOpacity>
                </BlurView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Barra superior */}
      <View style={[s.topBar, { paddingTop:insets.top+12 }]}>
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
      <View style={[s.botBar, { paddingBottom:insets.bottom+20 }]}>
        {/* Duração mini */}
        <BlurView intensity={50} tint="dark" style={s.durMini}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d.hours} style={[s.durMiniBtn, duration===d.hours && s.durMiniBtnOn]} onPress={() => setDuration(d.hours)} activeOpacity={0.8}>
              <Text style={[s.durMiniLabel, duration===d.hours && s.durMiniLabelOn]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* Publicar — só aparece com conteúdo */}
        {(mediaUri || textLayers.length > 0) && (
          <TouchableOpacity style={[s.pubBtn, uploading && { opacity:0.5 }]} onPress={handlePublish} disabled={uploading} activeOpacity={0.88}>
            {uploading
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.pubLabel}>{uploadMsg||"Enviando..."}</Text></>
              : <><Text style={s.pubLabel}>Publicar</Text><Ionicons name="send" size={15} color="#fff" /></>
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
    <TouchableOpacity style={hc.card} onPress={onPress} activeOpacity={0.75}>
      <LinearGradient colors={[accent+"33", accent+"11"]} style={hc.grad}>
        <View style={[hc.ring, { borderColor:accent+"55" }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
      </LinearGradient>
      <Text style={hc.label}>{label}</Text>
      <Text style={hc.sub}>{sub}</Text>
    </TouchableOpacity>
  );
}
const hc = StyleSheet.create({
  card:  { flex:1, alignItems:"center", gap:10, paddingVertical:22, paddingHorizontal:8 },
  grad:  { width:64, height:64, borderRadius:20, alignItems:"center", justifyContent:"center" },
  ring:  { width:56, height:56, borderRadius:16, borderWidth:1, alignItems:"center", justifyContent:"center" },
  label: { fontSize:13, fontWeight:"700", color:"#fff", letterSpacing:-0.2 },
  sub:   { fontSize:11, color:"rgba(255,255,255,0.4)", textAlign:"center" },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:"#000" },
  orb1: { position:"absolute", width:300, height:300, borderRadius:150, backgroundColor:"#7C3AED", opacity:0.16, top:-80, right:-80 },
  orb2: { position:"absolute", width:220, height:220, borderRadius:110, backgroundColor:"#06B6D4", opacity:0.10, top:140, left:-70 },
  orb3: { position:"absolute", width:180, height:180, borderRadius:90,  backgroundColor:"#F43F5E", opacity:0.09, bottom:180, right:10 },

  // Hero
  iconBtn:      { position:"absolute", zIndex:20, width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.08)", alignItems:"center", justifyContent:"center" },
  heroWrap:     { flex:1, paddingHorizontal:28, gap:14, justifyContent:"center" },
  heroBadge:    { flexDirection:"row", alignSelf:"flex-start", backgroundColor:"rgba(124,58,237,0.2)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(124,58,237,0.45)", paddingHorizontal:12, paddingVertical:5, borderRadius:20 },
  heroBadgeText:{ color:"#A78BFA", fontSize:11, fontWeight:"800", letterSpacing:1.8 },
  heroTitle:    { fontSize:28, fontWeight:"800", color:"#fff", lineHeight:36, letterSpacing:-0.5 },
  heroSub:      { fontSize:13, color:"rgba(255,255,255,0.4)", lineHeight:20 },
  durationRow:  { flexDirection:"row", gap:8, marginTop:4 },
  durBtn:       { paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:"rgba(255,255,255,0.07)", borderWidth:StyleSheet.hairlineWidth, borderColor:"rgba(255,255,255,0.08)" },
  durBtnOn:     { backgroundColor:"rgba(124,58,237,0.3)", borderColor:"rgba(124,58,237,0.6)" },
  durLabel:     { color:"rgba(255,255,255,0.45)", fontSize:13, fontWeight:"600" },
  durLabelOn:   { color:"#A78BFA", fontWeight:"800" },
  durHint:      { fontSize:12, color:"rgba(255,255,255,0.25)" },
  actionGrid:   { flexDirection:"row", paddingHorizontal:16, paddingTop:16, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:"rgba(255,255,255,0.07)" },

  // Câmera
  camTop:      { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  camBtn:      { width:40, height:40, borderRadius:20, backgroundColor:"rgba(0,0,0,0.5)", alignItems:"center", justifyContent:"center" },
  camBtnOn:    { backgroundColor:"rgba(251,191,36,0.5)" },
  camBase:     { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:32, zIndex:10 },
  camSideBtn:  { width:52, alignItems:"center", gap:4 },
  camSideLabel:{ color:"rgba(255,255,255,0.7)", fontSize:10, fontWeight:"600" },
  shutter:     { alignItems:"center", justifyContent:"center" },
  shutterRing: { width:80, height:80, borderRadius:40, borderWidth:4, borderColor:"rgba(255,255,255,0.9)", alignItems:"center", justifyContent:"center" },
  shutterCore: { width:64, height:64, borderRadius:32, backgroundColor:"#fff" },

  // Editor
  mediaBg:  { ...StyleSheet.absoluteFillObject, backgroundColor:"#000" },
  mediaImg: { width:"100%", height:"100%", flex:1 },
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.04)" },
  topBar:   { position:"absolute", top:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, zIndex:10 },
  editorBtn:{ width:38, height:38, borderRadius:19, backgroundColor:"rgba(0,0,0,0.55)", alignItems:"center", justifyContent:"center" },
  toolbar:  { position:"absolute", right:14, borderRadius:16, overflow:"hidden", zIndex:25 },
  toolBtn:  { width:38, height:38, alignItems:"center", justifyContent:"center" },
  toolDivider: { height:StyleSheet.hairlineWidth, backgroundColor:"rgba(255,255,255,0.15)", marginHorizontal:8 },
  botBar:   { position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingTop:12, zIndex:10 },
  durMini:  { flexDirection:"row", borderRadius:20, overflow:"hidden", padding:3, gap:2 },
  durMiniBtn:   { paddingHorizontal:10, paddingVertical:5, borderRadius:16 },
  durMiniBtnOn: { backgroundColor:"rgba(124,58,237,0.75)" },
  durMiniLabel:   { color:"rgba(255,255,255,0.45)", fontSize:11, fontWeight:"600" },
  durMiniLabelOn: { color:"#fff", fontWeight:"800" },
  pubBtn:   { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#7C3AED", paddingHorizontal:22, paddingVertical:12, borderRadius:26 },
  pubLabel: { color:"#fff", fontWeight:"700", fontSize:14 },

  // Modal texto
  textBg:    { flex:1, backgroundColor:"rgba(0,0,0,0.65)", justifyContent:"flex-end" },
  textSheet: { backgroundColor:"rgba(12,12,18,0.98)", borderTopLeftRadius:26, borderTopRightRadius:26, padding:20, gap:14 },
  colorRow:  { gap:8, paddingVertical:2 },
  colorDot:  { width:28, height:28, borderRadius:14 },
  colorDotOn:{ borderWidth:3, borderColor:"#fff", transform:[{ scale:1.2 }] },
  textCtrl:  { flexDirection:"row", alignItems:"center", gap:8 },
  ctrlBtn:   { width:34, height:34, borderRadius:10, backgroundColor:"rgba(255,255,255,0.08)", alignItems:"center", justifyContent:"center" },
  ctrlBtnOn: { backgroundColor:"rgba(124,58,237,0.55)" },
  sizeNum:   { color:"rgba(255,255,255,0.6)", fontSize:12, paddingHorizontal:8 },
  textIn:    { minHeight:56, textAlignVertical:"top", paddingVertical:4 },
  addTextBtn:{ backgroundColor:"#7C3AED", borderRadius:14, paddingVertical:12, alignItems:"center" },
  addTextLabel:{ color:"#fff", fontWeight:"700", fontSize:14 },
  modalBg:     { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"center", paddingHorizontal:24 },
  modalSheet:  { borderRadius:22, overflow:"hidden", backgroundColor:"rgba(10,10,15,0.85)" },
  modalBlur:   { paddingBottom:4 },
  modalHeader: { alignItems:"center", paddingVertical:22, paddingHorizontal:20, gap:6 },
  modalIcon:   { width:48, height:48, borderRadius:24, alignItems:"center", justifyContent:"center", marginBottom:4 },
  modalTitle:  { fontSize:17, fontWeight:"700", color:"#fff", letterSpacing:-0.3 },
  modalSub:    { fontSize:13, color:"rgba(255,255,255,0.45)" },
  modalDivider:{ height:StyleSheet.hairlineWidth, backgroundColor:"rgba(255,255,255,0.1)" },
  modalAction: { flexDirection:"row", alignItems:"center", paddingHorizontal:20, paddingVertical:18 },
});
