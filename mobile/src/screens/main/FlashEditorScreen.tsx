/**
 * FlashEditorScreen.tsx — v4
 *
 * Visual: mesmo padrão das telas de auth — fundo #0D1018, glassmorphism BlurView,
 * botões estilo Sign In (borderRadius 50, fundo translúcido).
 * Banner: imagem local da montanha nevada.
 * Degradê: rgba(0,0,0,x) de baixo pra cima, sutil.
 * TextEditorModal: sem <Modal> nativo — overlay absoluto (evita bug nav bar Android).
 *
 * Decisões técnicas mantidas:
 *  Pan: PanResponder (estável no Expo Go)
 *  Pinch: GestureDetector isolado por layer
 *  Rotate: desabilitado no Expo Go
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Animated, PanResponder,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, BackHandler, Image,
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

import { uploadImage } from '../../services/supabase.service';
import api from '../../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

// Banner local — montanha nevada P&B
const BANNER = require('../../../assets/flash-banner.jpg');

// Cores — mesmo padrão auth
const C = {
  bg:      '#0D1018',
  surface: 'rgba(255,255,255,0.05)',
  border:  'rgba(255,255,255,0.08)',
  text:    '#F1F5F9',
  textSec: 'rgba(241,245,249,0.45)',
  primary: '#64748B',
  btnBg:   '#F1F5F9',
  btnText: '#0D1018',
};

const BG_LIST: Array<
  { type: 'gradient'; colors: [string, string] } |
  { type: 'solid'; color: string }
> = [
  { type: 'solid',    color: '#0D1018' },  // default — mesmo fundo das telas auth
  { type: 'gradient', colors: ['#EC4899', '#8B5CF6'] },
  { type: 'gradient', colors: ['#F59E0B', '#EF4444'] },
  { type: 'gradient', colors: ['#10B981', '#059669'] },
  { type: 'gradient', colors: ['#3B82F6', '#06B6D4'] },
  { type: 'gradient', colors: ['#F97316', '#FBBF24'] },
  { type: 'gradient', colors: ['#6366F1', '#A78BFA'] },
  { type: 'gradient', colors: ['#0F172A', '#1E3A5F'] },
  { type: 'solid',    color: '#000000' },
  { type: 'solid',    color: '#1E1E2E' },
  { type: 'solid',    color: '#FFFFFF' },
  { type: 'solid',    color: '#111827' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F1F5F9', '#94A3B8',
  '#FBBF24', '#A3E635', '#FB923C', '#F472B6',
];

const TEXT_SIZES = [16, 20, 24, 28, 36, 44];

const DURATIONS = [
  { label: '1h',  value: 1  },
  { label: '6h',  value: 6  },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
];

const HIT = { top: 14, bottom: 14, left: 14, right: 14 };

interface TextLayer {
  id: string; text: string; color: string; size: number;
  bold: boolean; italic: boolean; highlight: boolean;
  x: number; y: number; scale: number; mirrored: boolean;
}

type EditorMode = 'select' | 'camera' | 'preview';

// ─────────────────────────────────────────────────────────────────────────────
export default function FlashEditorScreen() {
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<EditorMode>('select');

  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [facing,    setFacing]    = useState<CameraType>('front');
  const [torch,     setTorch]     = useState(false);
  const cameraRef                 = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  const [imageUri,   setImageUri]   = useState<string | null>(null);
  const [bgIndex,    setBgIndex]    = useState(0);
  const [layers,     setLayers]     = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duration,   setDuration]   = useState(24);

  const [textModalVisible, setTextModalVisible] = useState(false);
  const [editingLayer,     setEditingLayer]     = useState<TextLayer | null>(null);
  const [draftText,        setDraftText]        = useState('');
  const [draftColor,       setDraftColor]       = useState('#FFFFFF');
  const [draftSize,        setDraftSize]        = useState(24);
  const [draftBold,        setDraftBold]        = useState(false);
  const [draftItalic,      setDraftItalic]      = useState(false);
  const [draftHighlight,   setDraftHighlight]   = useState(false);
  const modalAnim = useRef(new Animated.Value(SH)).current;
  const modalFade = useRef(new Animated.Value(0)).current;

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (textModalVisible) { closeTextModal(); return true; }
      if (mode === 'preview') { setMode('select'); return true; }
      if (mode === 'camera')  { setMode('select'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [mode, textModalVisible]);

  const openCamera = useCallback(async () => {
    if (!camPermission?.granted) {
      const res = await requestCamPermission();
      if (!res.granted) { Alert.alert('Permissão necessária', 'Precisamos acessar a câmera.'); return; }
    }
    setFacing('front'); setTorch(false); setMode('camera');
  }, [camPermission, requestCamPermission]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) { setImageUri(photo.uri); setLayers([]); setSelectedId(null); setMode('preview'); }
    } catch (e) { console.warn('takePicture error', e); }
    finally { setCapturing(false); }
  }, [capturing]);

  const openGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri); setLayers([]); setSelectedId(null); setMode('preview');
    }
  }, []);

  const openTextModal = useCallback((layer?: TextLayer) => {
    if (layer) {
      setEditingLayer(layer); setDraftText(layer.text); setDraftColor(layer.color);
      setDraftSize(layer.size); setDraftBold(layer.bold); setDraftItalic(layer.italic);
      setDraftHighlight(layer.highlight);
    } else {
      setEditingLayer(null); setDraftText(''); setDraftColor('#FFFFFF');
      setDraftSize(24); setDraftBold(false); setDraftItalic(false); setDraftHighlight(false);
    }
    setTextModalVisible(true);
    modalAnim.setValue(SH); modalFade.setValue(0);
    Animated.parallel([
      Animated.spring(modalAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }),
      Animated.timing(modalFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [modalAnim, modalFade]);

  const closeTextModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(modalAnim, { toValue: SH, duration: 240, useNativeDriver: true }),
      Animated.timing(modalFade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setTextModalVisible(false));
  }, [modalAnim, modalFade]);

  const confirmText = useCallback(() => {
    if (!draftText.trim()) { closeTextModal(); return; }
    if (editingLayer) {
      setLayers(prev => prev.map(l =>
        l.id === editingLayer.id
          ? { ...l, text: draftText.trim(), color: draftColor, size: draftSize,
              bold: draftBold, italic: draftItalic, highlight: draftHighlight }
          : l
      ));
    } else {
      setLayers(prev => [...prev, {
        id: Crypto.randomUUID(), text: draftText.trim(), color: draftColor,
        size: draftSize, bold: draftBold, italic: draftItalic, highlight: draftHighlight,
        x: SW / 2 - 60, y: SH / 2 - 40, scale: 1, mirrored: false,
      }]);
    }
    setSelectedId(null); closeTextModal();
  }, [draftText, draftColor, draftSize, draftBold, draftItalic, draftHighlight, editingLayer, closeTextModal]);

  const hasContent = imageUri !== null || layers.length > 0;

  const publish = useCallback(async () => {
    if (!hasContent || uploading) return;
    setUploading(true);
    try {
      let mediaUrl: string | undefined;
      if (imageUri) mediaUrl = await uploadImage(imageUri, 'stories', facing === 'front');
      const caption = JSON.stringify({
        layers: layers.map(l => ({
          text: l.text, color: l.color, size: l.size,
          bold: l.bold, italic: l.italic, highlight: l.highlight,
          x: Math.round(l.x), y: Math.round(l.y), scale: l.scale,
        })),
        bgIndex,
      });
      await api.post('/stories', { mediaUrl, caption, durationHours: duration });
      navigation.navigate('Tabs', { screen: 'Feed' });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao publicar Flash.');
    } finally { setUploading(false); }
  }, [hasContent, uploading, imageUri, layers, bgIndex, duration, facing, navigation]);

  if (mode === 'select') {
    return (
      <SelectMode
        onCamera={openCamera}
        onGallery={openGallery}
        onText={() => {
          setImageUri(null); setLayers([]); setSelectedId(null); setMode('preview');
          setTimeout(() => openTextModal(), 120);
        }}
        onClose={() => navigation.goBack()}
      />
    );
  }

  if (mode === 'camera') {
    return (
      <CameraMode
        cameraRef={cameraRef} facing={facing} torch={torch} capturing={capturing}
        onFlip={() => setFacing(f => f === 'front' ? 'back' : 'front')}
        onTorch={() => setTorch(t => !t)}
        onShutter={takePhoto} onGallery={openGallery} onBack={() => setMode('select')}
      />
    );
  }

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null;

  const renderBg = () => {
    if (imageUri) return <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
    const bg = BG_LIST[bgIndex] ?? BG_LIST[0];
    if (bg.type === 'gradient') return <LinearGradient colors={bg.colors} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />;
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: bg.color }]} />;
  };

  return (
    <GestureHandlerRootView style={ss.flex}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <TouchableOpacity style={ss.flex} activeOpacity={1} onPress={() => setSelectedId(null)}>
        {renderBg()}
        {layers.map(layer => (
          <DraggableTextLayer
            key={layer.id} layer={layer} isSelected={layer.id === selectedId}
            onSelect={() => setSelectedId(layer.id)}
            onDoubleTap={() => openTextModal(layer)}
            onMove={(x, y) => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x, y } : l))}
            onScale={(scale) => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, scale } : l))}
          />
        ))}
      </TouchableOpacity>

      {/* Top bar */}
      <View style={ss.previewTop} pointerEvents="box-none">
        <TouchableOpacity onPress={() => setMode('select')} hitSlop={HIT} activeOpacity={0.7}>
          <BlurView intensity={40} tint="dark" style={ss.topBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </BlurView>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!imageUri && (
            <TouchableOpacity onPress={() => setBgIndex(i => (i + 1) % BG_LIST.length)} hitSlop={HIT} activeOpacity={0.7}>
              <BlurView intensity={40} tint="dark" style={ss.topBtn}>
                <Ionicons name="color-palette-outline" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => openTextModal()} hitSlop={HIT} activeOpacity={0.7}>
            <BlurView intensity={40} tint="dark" style={ss.topBtnAa}>
              <Text style={ss.topBtnAaText}>Aa</Text>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor de fundos */}
      {!imageUri && (
        <View style={ss.bgPickerContainer} pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.bgPickerScroll}>
            {BG_LIST.map((bg, i) => (
              <TouchableOpacity key={i} onPress={() => setBgIndex(i)} activeOpacity={0.8}
                style={[ss.bgSwatch, bgIndex === i && ss.bgSwatchSelected]}>
                {bg.type === 'gradient'
                  ? <LinearGradient colors={bg.colors} style={ss.bgSwatchInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  : <View style={[ss.bgSwatchInner, { backgroundColor: bg.color, borderWidth: bg.color === '#FFFFFF' ? 1 : 0, borderColor: 'rgba(255,255,255,0.3)' }]} />
                }
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Toolbar flutuante */}
      {selectedLayer && (
        <View style={ss.floatingToolbar} pointerEvents="box-none">
          <BlurView intensity={55} tint="dark" style={ss.floatingBlur}>
            <TouchableOpacity onPress={() => openTextModal(selectedLayer)} hitSlop={HIT} activeOpacity={0.7} style={ss.toolbarBtn}>
              <Ionicons name="pencil-outline" size={18} color="#fff" />
              <Text style={ss.toolbarBtnLabel}>Editar</Text>
            </TouchableOpacity>
            <View style={ss.toolbarDivider} />
            <TouchableOpacity onPress={() => setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, mirrored: !l.mirrored } : l))}
              hitSlop={HIT} activeOpacity={0.7} style={ss.toolbarBtn}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
              <Text style={ss.toolbarBtnLabel}>Espelhar</Text>
            </TouchableOpacity>
            <View style={ss.toolbarDivider} />
            <TouchableOpacity onPress={() => { setLayers(prev => prev.filter(l => l.id !== selectedLayer.id)); setSelectedId(null); }}
              hitSlop={HIT} activeOpacity={0.7} style={ss.toolbarBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[ss.toolbarBtnLabel, { color: '#EF4444' }]}>Deletar</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

      {/* Duração + Publicar */}
      <View style={ss.previewBottom} pointerEvents="box-none">
        <View style={ss.durationRow}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d.value} onPress={() => setDuration(d.value)} activeOpacity={0.8}
              style={[ss.durationPill, duration === d.value && ss.durationPillActive]}>
              <BlurView intensity={duration === d.value ? 0 : 40} tint="dark" style={ss.durationBlur}>
                <Text style={[ss.durationLabel, { color: duration === d.value ? '#000' : '#fff' }]}>{d.label}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        {hasContent && (
          <TouchableOpacity onPress={publish} disabled={uploading} activeOpacity={0.85} style={ss.publishBtn}>
            {uploading
              ? <ActivityIndicator color={C.btnText} />
              : <><Text style={ss.publishLabel}>Publicar Flash</Text><Ionicons name="flash" size={18} color={C.btnText} /></>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* TextEditorModal — overlay absoluto, sem <Modal> nativo */}
      {textModalVisible && (
        <TextEditorModal
          modalAnim={modalAnim} modalFade={modalFade}
          draftText={draftText} draftColor={draftColor} draftSize={draftSize}
          draftBold={draftBold} draftItalic={draftItalic} draftHighlight={draftHighlight}
          onSetText={setDraftText} onSetColor={setDraftColor} onSetSize={setDraftSize}
          onToggleBold={() => setDraftBold(v => !v)}
          onToggleItalic={() => setDraftItalic(v => !v)}
          onToggleHighlight={() => setDraftHighlight(v => !v)}
          onConfirm={confirmText} onCancel={closeTextModal}
        />
      )}
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECT MODE
// ─────────────────────────────────────────────────────────────────────────────
function SelectMode({ onCamera, onGallery, onText, onClose }: any) {
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
    NavigationBar.setPositionAsync('absolute').catch(() => {});
    return () => {
      // Restaura ao sair do SelectMode
      NavigationBar.setPositionAsync('relative').catch(() => {});
    };
  }, []);

  return (
    <View style={ss.selectRoot}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Banner — imagem esticada para cobrir 100% incluindo nav bar */}
      <Image
        source={BANNER}
        style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH + 100 }}
        resizeMode="stretch"
      />

      {/* Degradê de baixo pra cima — sombra intensa embaixo, desaparece no meio */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.97)',
          'rgba(0,0,0,0.91)',
          'rgba(0,0,0,0.79)',
          'rgba(0,0,0,0.50)',
          'rgba(0,0,0,0.30)',
          'rgba(0,0,0,0.12)',
          'rgba(0,0,0,0.03)',
          'transparent',
        ]}
        locations={[0, 0.12, 0.25, 0.40, 0.55, 0.70, 0.85, 1]}
        style={ss.bannerFadeGrad}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
      />

      {/* Gradiente sutil no topo para o botão fechar */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={ss.bannerTopGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Botão fechar */}
      <TouchableOpacity onPress={onClose} hitSlop={HIT} activeOpacity={0.7} style={ss.bannerCloseBtn}>
        <BlurView intensity={45} tint="dark" style={ss.blurCircle}>
          <Ionicons name="close" size={20} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      {/* Branding */}
      <View style={ss.bannerBranding}>
        <Ionicons name="flash" size={28} color={C.text} />
        <View>
          <Text style={ss.bannerTitle}>Flash</Text>
          <Text style={ss.bannerSlogan}>MOMENTOS QUE DESAPARECEM</Text>
        </View>
      </View>

      {/* Botões de ação */}
      <View style={ss.actionOverlay}>

        {/* Câmera — botão primário estilo auth */}
        <TouchableOpacity onPress={onCamera} activeOpacity={0.85} style={ss.primaryBtn}>
          <BlurView intensity={70} tint="dark" style={ss.primaryBlur}>
            <View style={ss.primaryInner}>
              <View style={ss.primaryIconWrap}>
                <Ionicons name="camera" size={22} color={C.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.primaryLabel}>Câmera</Text>
                <Text style={ss.primarySub}>Capture o momento agora</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textSec} />
            </View>
          </BlurView>
        </TouchableOpacity>

        {/* Galeria + Texto — botões secundários */}
        <View style={ss.secondaryRow}>
          <TouchableOpacity onPress={onGallery} activeOpacity={0.85} style={ss.secondaryBtn}>
            <BlurView intensity={60} tint="dark" style={ss.secondaryBlur}>
              <View style={ss.secondaryInner}>
                <Ionicons name="images" size={20} color={C.text} />
                <Text style={ss.secondaryLabel}>Galeria</Text>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity onPress={onText} activeOpacity={0.85} style={ss.secondaryBtn}>
            <BlurView intensity={60} tint="dark" style={ss.secondaryBlur}>
              <View style={ss.secondaryInner}>
                <Ionicons name="text" size={20} color={C.text} />
                <Text style={ss.secondaryLabel}>Texto</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA MODE
// ─────────────────────────────────────────────────────────────────────────────
function CameraMode({ cameraRef, facing, torch, capturing, onFlip, onTorch, onShutter, onGallery, onBack }: any) {
  return (
    <View style={ss.flex}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <CameraView ref={cameraRef} style={ss.flex} facing={facing} enableTorch={torch && facing === 'back'}>
        <View style={ss.camTop}>
          <TouchableOpacity onPress={onBack} hitSlop={HIT} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {facing === 'back' && (
            <TouchableOpacity onPress={onTorch} hitSlop={HIT} activeOpacity={0.7}>
              <Ionicons name={torch ? 'flash' : 'flash-off'} size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <View style={ss.camBottom}>
          <TouchableOpacity onPress={onGallery} activeOpacity={0.7} style={ss.camSideBtn}>
            <Ionicons name="images-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShutter} activeOpacity={0.85} disabled={capturing} style={ss.shutterOuter}>
            <View style={ss.shutterInner}>
              {capturing && <ActivityIndicator color="#000" size="small" />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onFlip} activeOpacity={0.7} style={ss.camSideBtn}>
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAGGABLE TEXT LAYER
// ─────────────────────────────────────────────────────────────────────────────
interface DraggableTextLayerProps {
  layer: TextLayer; isSelected: boolean;
  onSelect: () => void; onDoubleTap: () => void;
  onMove: (x: number, y: number) => void; onScale: (scale: number) => void;
}

function DraggableTextLayer({ layer, isSelected, onSelect, onDoubleTap, onMove, onScale }: DraggableTextLayerProps) {
  const pos        = useRef(new Animated.ValueXY({ x: layer.x, y: layer.y })).current;
  const scaleAnim  = useRef(new Animated.Value(layer.scale)).current;
  const lastTap    = useRef(0);
  const isDragging = useRef(false);
  const baseScale  = useRef(layer.scale);

  useEffect(() => {
    if (!isDragging.current) pos.setValue({ x: layer.x, y: layer.y });
  }, [layer.x, layer.y]);

  useEffect(() => {
    baseScale.current = layer.scale;
    scaleAnim.setValue(layer.scale);
  }, [layer.scale]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
    onPanResponderGrant: () => {
      isDragging.current = false;
      pos.setOffset({ x: (pos.x as any)._value, y: (pos.y as any)._value });
      pos.setValue({ x: 0, y: 0 });
      const now = Date.now();
      if (now - lastTap.current < 300) { onDoubleTap(); } else { onSelect(); }
      lastTap.current = now;
    },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) isDragging.current = true;
      Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false })(_, g);
    },
    onPanResponderRelease: () => {
      pos.flattenOffset(); isDragging.current = false;
      onMove((pos.x as any)._value, (pos.y as any)._value);
    },
    onPanResponderTerminate: () => { pos.flattenOffset(); isDragging.current = false; },
  }), [layer.id]);

  const pinch = useMemo(() => Gesture.Pinch()
    .onUpdate(e => { scaleAnim.setValue(Math.max(0.5, Math.min(4, baseScale.current * e.scale))); })
    .onEnd(e => { const f = Math.max(0.5, Math.min(4, baseScale.current * e.scale)); baseScale.current = f; onScale(f); }),
  [layer.id]);

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View
        style={[ss.textLayerContainer, {
          borderWidth: isSelected ? 1.5 : 0,
          borderColor: isSelected ? 'rgba(255,255,255,0.85)' : 'transparent',
          backgroundColor: layer.highlight ? 'rgba(0,0,0,0.45)' : 'transparent',
          transform: [
            ...pos.getTranslateTransform(),
            { scale: scaleAnim },
            ...(layer.mirrored ? [{ scaleX: -1 }] : []),
          ],
        }]}
        {...pan.panHandlers}
      >
        <Text style={{
          color: layer.color, fontSize: layer.size,
          fontWeight: layer.bold ? '700' : '400',
          fontStyle: layer.italic ? 'italic' : 'normal',
        }} selectable={false}>
          {layer.text}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EDITOR MODAL — overlay absoluto, sem <Modal> nativo
// ─────────────────────────────────────────────────────────────────────────────
function TextEditorModal({
  modalAnim, modalFade,
  draftText, draftColor, draftSize, draftBold, draftItalic, draftHighlight,
  onSetText, onSetColor, onSetSize, onToggleBold, onToggleItalic, onToggleHighlight,
  onConfirm, onCancel,
}: any) {
  const insets  = useSafeAreaInsets();
  const dragY   = useRef(new Animated.Value(0)).current;

  // Swipe down para fechar
  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.8) {
        onCancel();
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      }
    },
  })).current;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[ss.modalBackdrop, { opacity: modalFade }]} pointerEvents="auto">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onCancel} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        style={ss.modalKav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[ss.modalSheet, { transform: [{ translateY: Animated.add(modalAnim, dragY) }] }]}
          pointerEvents="auto"
        >
          <View style={[ss.modalBlur, { paddingBottom: Math.max(insets.bottom, 16) + 16, backgroundColor: '#0D1018' }]}>
            {/* Handle com swipe down */}
            <View style={ss.modalHandleArea} {...swipePan.panHandlers}>
              <View style={ss.modalHandle} />
            </View>

            {/* Prévia + Input com altura fixa — não cresce */}
            <View style={ss.modalPreview}>
              <Text style={{
                color: draftText ? draftColor : 'rgba(241,245,249,0.2)',
                fontSize: Math.min(draftSize, 28),
                fontWeight: draftBold ? '700' : '400',
                fontStyle: draftItalic ? 'italic' : 'normal',
                backgroundColor: draftHighlight ? 'rgba(0,0,0,0.45)' : 'transparent',
                letterSpacing: -0.5,
                padding: draftHighlight ? 4 : 0,
                borderRadius: 3,
              }} numberOfLines={2} ellipsizeMode="tail">
                {draftText || 'Comece a escrever...'}
              </Text>
            </View>

            {/* Input altura fixa — nunca estica o modal */}
            <TextInput
              value={draftText} onChangeText={onSetText}
              placeholder="Digite aqui..." placeholderTextColor={C.textSec}
              style={ss.modalInput} multiline autoFocus maxLength={200}
            />

            {/* Formatação */}
            <View style={ss.formatRow}>
              <TouchableOpacity onPress={onToggleBold} style={[ss.formatBtn, draftBold && ss.formatBtnActive]} activeOpacity={0.7}>
                <Text style={[ss.formatBtnText, { fontWeight: '700', color: draftBold ? C.btnText : '#fff' }]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onToggleItalic} style={[ss.formatBtn, draftItalic && ss.formatBtnActive]} activeOpacity={0.7}>
                <Text style={[ss.formatBtnText, { fontStyle: 'italic', color: draftItalic ? C.btnText : '#fff' }]}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onToggleHighlight} style={[ss.formatBtn, draftHighlight && ss.formatBtnActive]} activeOpacity={0.7}>
                <Ionicons name="color-fill-outline" size={16} color={draftHighlight ? C.btnText : '#fff'} />
              </TouchableOpacity>
            </View>

            {/* Tamanhos */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.sizesRow}>
              {TEXT_SIZES.map(s => (
                <TouchableOpacity key={s} onPress={() => onSetSize(s)}
                  style={[ss.sizePill, draftSize === s && ss.sizePillActive]} activeOpacity={0.7}>
                  <Text style={[ss.sizePillLabel, { color: draftSize === s ? C.btnText : '#fff' }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Paleta */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.colorsRow}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => onSetColor(c)}
                  style={[ss.colorSwatch, { backgroundColor: c, borderWidth: c === '#FFFFFF' ? 1 : 0, borderColor: 'rgba(255,255,255,0.3)' },
                    draftColor === c && ss.colorSwatchSelected]}
                  activeOpacity={0.8} />
              ))}
            </ScrollView>

            {/* Ações — mesmo estilo auth */}
            <View style={ss.modalActions}>
              <TouchableOpacity onPress={onCancel} style={ss.modalCancelBtn} activeOpacity={0.7}>
                <Text style={ss.modalCancelLabel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onConfirm}
                style={[ss.modalConfirmBtn, !draftText.trim() && { opacity: 0.4 }]}
                activeOpacity={0.8} disabled={!draftText.trim()}>
                <Text style={ss.modalConfirmLabel}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  flex: { flex: 1 },

  // SELECT
  selectRoot:     { flex: 1, width: SW, height: SH, backgroundColor: C.bg },
  bannerFadeGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SH * 0.6 }, // Isso faz o degradê ocupar só os 60% inferiores da tela em vez da tela inteira — a sombra fica concentrada embaixo onde os botões estão.
  bannerTopGrad:  { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  bannerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 44, left: 20 },
  blurCircle:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bannerBranding: {
    position: 'absolute', top: SH * 0.36, left: 24,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  bannerTitle:    { color: C.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  bannerSlogan:   { color: C.textSec, fontSize: 10, fontWeight: '600', letterSpacing: 2.5 },

  actionOverlay: {
    position: 'absolute', left: 20, right: 20,
    bottom: Platform.OS === 'ios' ? 90 : 80,
    gap: 10,
  },

  // Botão primário — glassmorphism
  primaryBtn: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  primaryBlur: {},
  primaryInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 14,
    backgroundColor: C.surface,
  },
  primaryIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
  primarySub:   { color: C.textSec, fontSize: 12, marginTop: 2 },

  // Botões secundários
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  secondaryBlur: {},
  secondaryInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, backgroundColor: C.surface,
  },
  secondaryLabel: { color: C.text, fontSize: 15, fontWeight: '600' },

  // CÂMERA
  camTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 44 },
  camBottom: { position: 'absolute', bottom: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  camSideBtn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 26 },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  // PREVIEW
  previewTop: { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 38, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topBtnAa: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topBtnAaText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  bgPickerContainer: { position: 'absolute', bottom: 148, left: 0, right: 0 },
  bgPickerScroll: { paddingHorizontal: 16, gap: 10 },
  bgSwatch: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  bgSwatchSelected: { borderColor: '#fff' },
  bgSwatchInner: { flex: 1 },

  floatingToolbar: { position: 'absolute', top: Platform.OS === 'ios' ? 110 : 96, alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  floatingBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8 },
  toolbarBtnLabel: { color: '#fff', fontSize: 13 },
  toolbarDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: 'rgba(255,255,255,0.25)' },

  previewBottom: { position: 'absolute', bottom: Platform.OS === 'ios' ? 72 : 60, left: 16, right: 16, gap: 14 },
  durationRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  durationPill: { borderRadius: 20, overflow: 'hidden' },
  durationPillActive: { backgroundColor: '#fff' },
  durationBlur: { paddingHorizontal: 18, paddingVertical: 8 },
  durationLabel: { fontSize: 14, fontWeight: '600' },

  // Botão publicar — mesmo estilo Sign In
  publishBtn: {
    backgroundColor: C.btnBg, borderRadius: 50, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  publishLabel: { color: C.btnText, fontSize: 16, fontWeight: '700' },

  // TEXT LAYER
  textLayerContainer: { position: 'absolute', padding: 6, borderRadius: 4, borderStyle: 'dashed' },

  // TEXT EDITOR MODAL
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalKav:      { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  modalSheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderBottomWidth: 0 },
  modalBlur:     { paddingTop: 0, paddingHorizontal: 16, gap: 10 },
  modalHandle:     { width: 36, height: 3, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center' },
  modalHandleArea: { paddingVertical: 12, alignItems: 'center' },
  modalPreview:  { height: 44, alignItems: 'center', justifyContent: 'center' },
  modalInput:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16, height: 80, textAlignVertical: 'top' },
  formatRow:     { flexDirection: 'row', gap: 10 },
  formatBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  formatBtnActive: { backgroundColor: C.btnBg, borderColor: C.btnBg },
  formatBtnText: { fontSize: 16 },
  sizesRow:      { gap: 8, paddingVertical: 2 },
  sizePill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sizePillActive:  { backgroundColor: C.btnBg, borderColor: C.btnBg },
  sizePillLabel: { fontSize: 13, fontWeight: '600' },
  colorsRow:     { gap: 10, paddingVertical: 2 },
  colorSwatch:   { width: 34, height: 34, borderRadius: 17 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: 50, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  modalCancelLabel: { color: C.text, fontSize: 15, fontWeight: '600' },
  modalConfirmBtn:  { flex: 2, paddingVertical: 14, borderRadius: 50, alignItems: 'center', backgroundColor: C.btnBg },
  modalConfirmLabel:{ color: C.btnText, fontSize: 15, fontWeight: '700' },
});
