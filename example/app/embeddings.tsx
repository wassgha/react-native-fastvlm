import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { FastVLM, useFastVLM } from 'react-native-fastvlm';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';

export default function EmbeddingsScreen() {
  const { status, initialize } = useFastVLM({ autoInitialize: true, autoLoad: true });

  const [inputText, setInputText] = useState('Hello world');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [textEmbedding, setTextEmbedding] = useState<number[] | null>(null);
  const [imageEmbedding, setImageEmbedding] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setImageEmbedding(null); // Reset previous result
    }
  };

  const handleGetTextEmbedding = async () => {
    try {
      setLoading(true);
      const result = await FastVLM.getTextEmbedding(inputText);
      setTextEmbedding(result.embedding);
    } catch (e) {
      console.error(e);
      alert('Error getting text embedding: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleGetImageEmbedding = async () => {
    if (!selectedImage) return;

    try {
      setLoading(true);
      const result = await FastVLM.getImageEmbedding({ uri: selectedImage });
      setImageEmbedding(result.embedding);
    } catch (e) {
      console.error(e);
      alert('Error getting image embedding: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const renderEmbedding = (embedding: number[] | null) => {
    if (!embedding) return null;

    return (
      <View style={styles.resultBox}>
        <Text style={styles.resultLabel}>
          Vector Dimension: {embedding.length}
        </Text>
        <Text style={styles.resultValue} numberOfLines={3}>
          [{embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}, ... ]
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Embeddings' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {status !== 'ready' && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              Model Status: {status}. Waiting for model to be ready...
            </Text>
            {status === 'not_downloaded' && (
              <Text style={styles.hintText}>Go back to home to download the model.</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text Embedding</Text>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Enter text..."
          />
          <TouchableOpacity
            style={[styles.actionButton, (loading || status !== 'ready') && styles.disabledButton]}
            onPress={handleGetTextEmbedding}
            disabled={loading || status !== 'ready'}
          >
            <Text style={styles.actionButtonText}>Get Text Embedding</Text>
          </TouchableOpacity>
          {renderEmbedding(textEmbedding)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Embedding</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (loading || status !== 'ready' || !selectedImage) && styles.disabledButton
            ]}
            onPress={handleGetImageEmbedding}
            disabled={loading || status !== 'ready' || !selectedImage}
          >
            <Text style={styles.actionButtonText}>Get Image Embedding</Text>
          </TouchableOpacity>
          {renderEmbedding(imageEmbedding)}
        </View>

      </ScrollView>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1C1C1E',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  imagePicker: {
    height: 150,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#007AFF',
    fontSize: 16,
  },
  resultBox: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 4,
  },
  resultValue: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#212529',
  },
  warningContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEEBA',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
  },
  hintText: {
    color: '#856404',
    fontSize: 12,
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
