import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView,
  Dimensions, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { postsService } from '../../services/posts.service';
import Avatar from '../../components/ui/Avatar';
import PrimaryButton from '../../components/ui/PrimaryButton';

const { width } = Dimensions.get('window');

export default function NewPostScreen() {
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handlePost = async () => {
    if (!caption.trim() && !image) return Alert.alert('Adicione um texto ou imagem');
    setLoading(true);
    try {
      let mediaUrls: string[] = [];
      let mediaType = 'text';
      if (image) {
        const ext = image.split('.').pop()?.split('?')[0] || 'jpg';
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl('posts', ext);
        const blob = await fetch(image).then(r => r.blob());
        await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
        mediaUrls = [publicUrl];
        mediaType = 'image';
      }
      await postsService.create(caption, mediaUrls, mediaType);
      setCaption('');
      setImage(null);
      Alert.alert('✓ Post publicado!');
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message || 'Erro ao publicar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Novo post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={loading}
          style={[styles.publishBtn, { opacity: loading ? 0.6 : 1 }]}
        >
          <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.publishGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.publishText}>Publicar</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* User info + input */}
          <View style={styles.inputArea}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={42} />
            <View style={styles.inputRight}>
              <Text style={[styles.authorName, { color: theme.text }]}>
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
                autoFocus
              />
            </View>
          </View>

          {/* Character count */}
          {caption.length > 0 && (
            <Text style={[styles.charCount, { color: caption.length > 450 ? theme.error : theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          )}

          {/* Image preview */}
          {image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={() => setImage(null)}
              >
                <View style={styles.removeImageBtn}>
                  <Ionicons name="close" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addImageBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={pickImage}
            >
              <Ionicons name="image-outline" size={28} color={theme.primaryLight} />
              <Text style={[styles.addImageText, { color: theme.textSecondary }]}>Adicionar imagem</Text>
            </TouchableOpacity>
          )}

          {/* Media options */}
          <View style={[styles.mediaOptions, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.mediaOption} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.mediaOptionText, { color: theme.textSecondary }]}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaOption}>
              <Ionicons name="camera-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.mediaOptionText, { color: theme.textSecondary }]}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaOption}>
              <Ionicons name="location-outline" size={20} color={theme.primaryLight} />
              <Text style={[styles.mediaOptionText, { color: theme.textSecondary }]}>Local</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  publishBtn: { borderRadius: 20, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 80, minHeight: 34 },
  publishText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  inputArea: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  inputRight: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 80 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: -8 },
  imageContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  imagePreview: { width: '100%', height: width * 0.8, borderRadius: 16 },
  removeImage: { position: 'absolute', top: 10, right: 10 },
  removeImageBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  addImageBtn: { borderWidth: 1.5, borderRadius: 16, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 8 },
  addImageText: { fontSize: 13 },
  mediaOptions: { flexDirection: 'row', gap: 24, borderTopWidth: 1, paddingTop: 16 },
  mediaOption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaOptionText: { fontSize: 13 },
});
