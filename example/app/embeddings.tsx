import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FastVLM } from 'react-native-fastvlm';
import type { EmbeddingResult } from 'react-native-fastvlm';

export default function EmbeddingsScreen() {
  const [text1, setText1] = useState('A photo of a cat');
  const [text2, setText2] = useState('A photo of a dog');
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    textSimilarity?: number;
    imageSimilarity?: number;
    textImageSimilarity?: number;
  }>({});

  const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const pickImage = useCallback(async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  }, []);

  const compareTexts = useCallback(async () => {
    if (!text1.trim() || !text2.trim()) {
      Alert.alert('Error', 'Please enter both texts');
      return;
    }

    setLoading(true);
    try {
      const [emb1, emb2] = await Promise.all([
        FastVLM.getTextEmbedding(text1.trim()),
        FastVLM.getTextEmbedding(text2.trim()),
      ]);

      const similarity = cosineSimilarity(emb1.embedding, emb2.embedding);
      setResults((prev) => ({ ...prev, textSimilarity: similarity }));
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setLoading(false);
    }
  }, [text1, text2]);

  const compareImages = useCallback(async () => {
    if (!image1 || !image2) {
      Alert.alert('Error', 'Please select both images');
      return;
    }

    setLoading(true);
    try {
      const [emb1, emb2] = await Promise.all([
        FastVLM.getImageEmbedding({ uri: image1 }),
        FastVLM.getImageEmbedding({ uri: image2 }),
      ]);

      const similarity = cosineSimilarity(emb1.embedding, emb2.embedding);
      setResults((prev) => ({ ...prev, imageSimilarity: similarity }));
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setLoading(false);
    }
  }, [image1, image2]);

  const compareTextImage = useCallback(async () => {
    if (!text1.trim() || !image1) {
      Alert.alert('Error', 'Please enter text and select an image');
      return;
    }

    setLoading(true);
    try {
      const [textEmb, imageEmb] = await Promise.all([
        FastVLM.getTextEmbedding(text1.trim()),
        FastVLM.getImageEmbedding({ uri: image1 }),
      ]);

      const similarity = cosineSimilarity(textEmb.embedding, imageEmb.embedding);
      setResults((prev) => ({ ...prev, textImageSimilarity: similarity }));
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setLoading(false);
    }
  }, [text1, image1]);

  const formatSimilarity = (value?: number): string => {
    if (value === undefined) return '-';
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.description}>
        Compare embeddings between texts and images to find semantic similarity.
      </Text>

      {/* Text Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Comparison</Text>
        <TextInput
          style={styles.textInput}
          value={text1}
          onChangeText={setText1}
          placeholder="Enter first text..."
          multiline
        />
        <TextInput
          style={styles.textInput}
          value={text2}
          onChangeText={setText2}
          placeholder="Enter second text..."
          multiline
        />
        <TouchableOpacity
          style={styles.button}
          onPress={compareTexts}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Compare Texts</Text>
          )}
        </TouchableOpacity>
        {results.textSimilarity !== undefined && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>Text Similarity:</Text>
            <Text style={styles.resultValue}>{formatSimilarity(results.textSimilarity)}</Text>
          </View>
        )}
      </View>

      {/* Image Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Comparison</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity
            style={styles.imagePicker}
            onPress={() => pickImage(setImage1)}
          >
            {image1 ? (
              <Image source={{ uri: image1 }} style={styles.imagePreview} />
            ) : (
              <Text style={styles.imagePickerText}>Select Image 1</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imagePicker}
            onPress={() => pickImage(setImage2)}
          >
            {image2 ? (
              <Image source={{ uri: image2 }} style={styles.imagePreview} />
            ) : (
              <Text style={styles.imagePickerText}>Select Image 2</Text>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={compareImages}
          disabled={loading || !image1 || !image2}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Compare Images</Text>
          )}
        </TouchableOpacity>
        {results.imageSimilarity !== undefined && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>Image Similarity:</Text>
            <Text style={styles.resultValue}>{formatSimilarity(results.imageSimilarity)}</Text>
          </View>
        )}
      </View>

      {/* Text-Image Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text-Image Comparison</Text>
        <Text style={styles.helperText}>
          Uses Text 1 and Image 1 from above
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={compareTextImage}
          disabled={loading || !text1.trim() || !image1}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Compare Text & Image</Text>
          )}
        </TouchableOpacity>
        {results.textImageSimilarity !== undefined && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>Text-Image Similarity:</Text>
            <Text style={styles.resultValue}>{formatSimilarity(results.textImageSimilarity)}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  imageRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imagePicker: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imagePickerText: {
    color: '#999',
    fontSize: 13,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  resultBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#1976d2',
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1976d2',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
});
