import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform, Switch, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { postsService } from "../../services/posts.service";
import Avatar from "../../components/ui/Avatar";

const { width } = Dimensions.get("window");

// Modal de preview antes de publicar
function PreviewModal({ visible, caption, image, isPrivate, showLikes, onEdit, onPublish, onClose, publishing }: any) {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={[preStyles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={[preStyles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity onPress={onClose} style={preStyles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[preStyles.headerTitle, { color: theme.text }]}>Prévia do post</Text>
          <TouchableOpacity
            onPress={onPublish}
            disabled={publishing}
            style={{ opacity: publishing ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={["#7C3AED", "#6D28D9"]}
              style={preStyles.publishBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {publishing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={preStyles.publishText}>Publicar</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Post preview */}
          <View style={[preStyles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={preStyles.postHeader}>
              <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={36} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[preStyles.postUser, { color: theme.text }]}>{user?.displayName || user?.username}</Text>
                <Text style={[preStyles.postTime, { color: theme.textSecondary }]}>Agora</Text>
              </View>
              {isPrivate && <Ionicons name="lock-closed" size={14} color={theme.textSecondary} />}
            </View>

            {caption ? (
              <Text style={[preStyles.postCaption, { color: theme.text }]}>{caption}</Text>
            ) : null}

            {image ? (
              <Image source={{ uri: image }} style={preStyles.postImage} resizeMode="cover" />
            ) : null}

            {showLikes && (
              <View style={preStyles.postActions}>
                <Ionicons name="heart-outline" size={22} color={theme.textSecondary} />
                <Text style={[preStyles.likesText, { color: theme.textSecondary }]}>0 curtidas</Text>
              </View>
            )}
          </View>

          {/* Opções */}
          <View style={[preStyles.options, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[preStyles.optTitle, { color: theme.textSecondary }]}>OPÇÕES DO POST</Text>

            <TouchableOpacity style={[preStyles.optRow, { borderBottomColor: theme.border }]} onPress={onEdit} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color={theme.primaryLight} />
              <Text style={[preStyles.optLabel, { color: theme.text }]}>Editar conteúdo</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={[preStyles.optRow, { borderBottomColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.primaryLight} />
              <Text style={[preStyles.optLabel, { color: theme.text }]}>Post privado</Text>
              <Switch value={isPrivate} onValueChange={onEdit} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>

            <View style={preStyles.optRow}>
              <Ionicons name="heart-outline" size={18} color={theme.primaryLight} />
              <Text style={[preStyles.optLabel, { color: theme.text }]}>Mostrar curtidas</Text>
              <Switch value={showLikes} onValueChange={onEdit} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const preStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  publishBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, minWidth: 80, alignItems: "center", justifyContent: "center", minHeight: 34 },
  publishText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  postCard: { margin: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", padding: 12 },
  postUser: { fontSize: 14, fontWeight: "600" },
  postTime: { fontSize: 11 },
  postCaption: { paddingHorizontal: 12, paddingBottom: 10, fontSize: 14, lineHeight: 20 },
  postImage: { width: "100%", height: width * 0.8 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  likesText: { fontSize: 13 },
  options: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 32 },
  optTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, padding: 12, paddingBottom: 8 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  optLabel: { flex: 1, fontSize: 14 },
});

// Tela principal de novo post
export default function NewPostScreen({ navigation }: any) {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showLikes, setShowLikes] = useState(true);
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
    if (!result.canceled) setImage(result.assets[0].uri);
  }, []);

  const handlePreview = () => {
    if (!caption.trim() && !image) {
      Alert.alert("Post vazio", "Adicione um texto ou imagem antes de continuar");
      return;
    }
    setPreviewVisible(true);
  };

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      let mediaUrls: string[] = [];
      let mediaType = "text";
      if (image) {
        const ext = image.split(".").pop()?.split("?")[0] || "jpg";
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl("posts", ext);
        const blob = await fetch(image).then(r => r.blob());
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        mediaUrls = [publicUrl];
        mediaType = "image";
      }
      await postsService.create(caption, mediaUrls, mediaType);
      setCaption("");
      setImage(null);
      setPreviewVisible(false);
      setIsPrivate(false);
      setShowLikes(true);
      Alert.alert("✓ Publicado!", "Seu post está no feed.");
      navigation?.navigate?.("Tabs", { screen: "Feed" });
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.message || "Erro ao publicar");
    } finally {
      setPublishing(false);
    }
  }, [caption, image, isPrivate, showLikes]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Novo post</Text>
        <TouchableOpacity
          onPress={handlePreview}
          style={styles.previewBtnWrap}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#7C3AED", "#6D28D9"]}
            style={styles.previewBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.previewBtnText}>Prévia →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Composer */}
          <View style={styles.composer}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={42} />
            <View style={styles.composerRight}>
              <Text style={[styles.composerName, { color: theme.text }]}>
                {user?.displayName || user?.username}
              </Text>
              <TextInput
                style={[styles.captionInput, { color: theme.text }]}
                placeholder="O que você quer compartilhar?"
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

          {caption.length > 400 && (
            <Text style={[styles.charCount, { color: caption.length > 480 ? theme.error : theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          )}

          {/* Image preview / picker */}
          {image ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
                <View style={styles.removeImgBtn}>
                  <Ionicons name="close" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.changeImg} onPress={pickImage}>
                <View style={styles.changeImgBtn}>
                  <Ionicons name="swap-horizontal" size={14} color="#fff" />
                </View>
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
          )}

          {/* Quick options */}
          <View style={[styles.quickOptions, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.quickOpt} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.quickOptText, { color: theme.textSecondary }]}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickOpt} activeOpacity={0.7}>
              <Ionicons name="at-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.quickOptText, { color: theme.textSecondary }]}>Mencionar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickOpt} activeOpacity={0.7}>
              <Ionicons name="location-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.quickOptText, { color: theme.textSecondary }]}>Local</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickOpt} activeOpacity={0.7}>
              <Ionicons name="code-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.quickOptText, { color: theme.textSecondary }]}>Código</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PreviewModal
        visible={previewVisible}
        caption={caption}
        image={image}
        isPrivate={isPrivate}
        showLikes={showLikes}
        onEdit={() => setPreviewVisible(false)}
        onPublish={handlePublish}
        onClose={() => setPreviewVisible(false)}
        publishing={publishing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  previewBtnWrap: { borderRadius: 20, overflow: "hidden" },
  previewBtn: { paddingHorizontal: 18, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  previewBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  composer: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  composerRight: { flex: 1 },
  composerName: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 80 },
  charCount: { fontSize: 11, textAlign: "right", marginTop: -8 },
  imageWrap: { borderRadius: 16, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: width * 0.75, borderRadius: 16 },
  removeImg: { position: "absolute", top: 10, right: 10 },
  removeImgBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  changeImg: { position: "absolute", top: 10, right: 48 },
  changeImgBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  addImageBtn: { borderWidth: 1.5, borderRadius: 16, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 8 },
  addImageText: { fontSize: 14, fontWeight: "600" },
  addImageSub: { fontSize: 11 },
  quickOptions: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 16, justifyContent: "space-around" },
  quickOpt: { alignItems: "center", gap: 4 },
  quickOptText: { fontSize: 11 },
});
