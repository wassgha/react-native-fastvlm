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
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFastVLM } from 'react-native-fastvlm';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';

export default function App() {
  const {
    status,
    downloadProgress,
    output,
    isGenerating,
    error,
    stats,
    download,
    load,
    generateStream,
    cancel,
    initialize,
  } = useFastVLM({ autoInitialize: true, autoLoad: true });

  const [prompt, setPrompt] = useState('Describe this image in detail.');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (status !== 'ready') {
      Alert.alert('Model not ready', `Current status: ${status}`);
      return;
    }

    try {
      await generateStream(
        {
          prompt,
          image: selectedImage ? { uri: selectedImage } : undefined,
        },
        {
          maxTokens: 500,
          temperature: 0.7,
        }
      );
    } catch (e) {
      console.error(e);
    }
  };

  const renderStatus = () => {
    switch (status) {
      case 'downloading':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.statusText}>
              Downloading Model... {(downloadProgress * 100).toFixed(1)}%
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${downloadProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        );
      case 'not_downloaded':
        return (
          <TouchableOpacity style={styles.actionButton} onPress={download}>
            <Text style={styles.actionButtonText}>Download Model</Text>
          </TouchableOpacity>
        );
      case 'initializing':
      case 'loading':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.statusText}>
              {status === 'initializing' ? 'Initializing...' : 'Loading Model...'}
            </Text>
          </View>
        );
      case 'ready':
        return (
          <View style={styles.readyContainer}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Model Ready</Text>
            </View>
          </View>
        );
      case 'error':
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={initialize}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return <Text>Status: {status}</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>FastVLM Demo</Text>
          <Link href="/embeddings" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkButtonText}>Go to Embeddings →</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Status</Text>
          {renderStatus()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Input</Text>

          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Prompt</Text>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Enter prompt..."
            multiline
          />

          <View style={styles.buttonRow}>
            {isGenerating ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.stopButton]}
                onPress={cancel}
              >
                <Text style={styles.actionButtonText}>Stop Generation</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  (status !== 'ready' || (!prompt && !selectedImage)) && styles.disabledButton,
                ]}
                onPress={handleGenerate}
                disabled={status !== 'ready' || (!prompt && !selectedImage)}
              >
                <Text style={styles.actionButtonText}>Generate</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {(output || isGenerating) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Output</Text>
            <View style={styles.outputContainer}>
              <Text style={styles.outputText}>{output}</Text>
              {isGenerating && <View style={styles.cursor} />}
            </View>

            {stats.tokenCount !== undefined && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {stats.tokenCount} tokens | {stats.tokensPerSecond?.toFixed(1)} t/s | {(stats.totalTimeMs! / 1000).toFixed(1)}s
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  linkButton: {
    padding: 8,
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 16,
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
  statusContainer: {
    alignItems: 'center',
    padding: 10,
  },
  statusText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  readyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#FF3B3015',
    borderRadius: 8,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  imagePicker: {
    height: 200,
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
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  outputContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
  outputText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  cursor: {
    width: 2,
    height: 20,
    backgroundColor: '#007AFF',
    marginTop: 4,
  },
  statsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statsText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
