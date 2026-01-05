import React, { useState, useEffect, useCallback } from 'react';
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
import type { TokenEvent, DownloadProgressEvent, GenerateResult } from 'react-native-fastvlm';

type ModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'loading' | 'generating' | 'error';

export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('not_downloaded');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [prompt, setPrompt] = useState('What do you see in this image?');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [stats, setStats] = useState<{
    promptTime?: number;
    totalTime?: number;
    tokensPerSecond?: number;
  }>({});

  // Initialize module and check model status
  useEffect(() => {
    async function init() {
      try {
        await FastVLM.initialize();
        const downloaded = await FastVLM.isModelDownloaded();
        setModelStatus(downloaded ? 'ready' : 'not_downloaded');
      } catch (error) {
        console.error('Failed to initialize FastVLM:', error);
        setModelStatus('error');
      }
    }
    init();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const tokenSub = FastVLM.addTokenListener((event: TokenEvent) => {
      setOutput(event.text);
      if (event.isComplete) {
        setIsStreaming(false);
      }
    });

    const progressSub = FastVLM.addDownloadProgressListener((event: DownloadProgressEvent) => {
      setDownloadProgress(event.progress);
    });

    const completeSub = FastVLM.addGenerationCompleteListener((event: GenerateResult) => {
      setStats({
        promptTime: event.promptTimeMs,
        totalTime: event.totalTimeMs,
        tokensPerSecond: event.tokensPerSecond,
      });
      setModelStatus('ready');
    });

    const errorSub = FastVLM.addErrorListener((event) => {
      Alert.alert('Error', event.error);
      setModelStatus('ready');
    });

    return () => {
      tokenSub.remove();
      progressSub.remove();
      completeSub.remove();
      errorSub.remove();
    };
  }, []);

  const handleDownload = useCallback(async () => {
    setModelStatus('downloading');
    setDownloadProgress(0);

    try {
      const success = await FastVLM.downloadModel();
      if (success) {
        await FastVLM.loadModel();
        setModelStatus('ready');
      } else {
        setModelStatus('error');
        Alert.alert('Error', 'Failed to download model');
      }
    } catch (error) {
      setModelStatus('error');
      Alert.alert('Error', String(error));
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    setOutput('');
    setStats({});
    setModelStatus('generating');
    setIsStreaming(true);

    try {
      await FastVLM.generateStream(
        {
          prompt: prompt.trim(),
          image: selectedImage ? { uri: selectedImage } : undefined,
        },
        {
          temperature: 0.0,
          maxTokens: 240,
        }
      );
    } catch (error) {
      Alert.alert('Error', String(error));
      setModelStatus('ready');
      setIsStreaming(false);
    }
  }, [prompt, selectedImage]);

  const handleCancel = useCallback(async () => {
    await FastVLM.cancelGeneration();
    setIsStreaming(false);
    setModelStatus('ready');
  }, []);

  const renderModelStatus = () => {
    switch (modelStatus) {
      case 'not_downloaded':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Model not downloaded</Text>
            <TouchableOpacity style={styles.button} onPress={handleDownload}>
              <Text style={styles.buttonText}>Download Model (~500MB)</Text>
            </TouchableOpacity>
          </View>
        );

      case 'downloading':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Downloading... {Math.round(downloadProgress * 100)}%
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
            </View>
          </View>
        );

      case 'loading':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.statusText}>Loading model...</Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, styles.errorText]}>Error loading model</Text>
            <TouchableOpacity style={styles.button} onPress={handleDownload}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const isReady = modelStatus === 'ready' || modelStatus === 'generating';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {renderModelStatus()}

      {isReady && (
        <>
          {/* Image Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Image (Optional)</Text>
            <View style={styles.imageButtons}>
              <TouchableOpacity
                style={[styles.button, styles.halfButton]}
                onPress={handlePickImage}
              >
                <Text style={styles.buttonText}>Pick Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.halfButton]}
                onPress={handleTakePhoto}
              >
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.removeImageText}>x</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Prompt Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prompt</Text>
            <TextInput
              style={styles.textInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Enter your prompt..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Generate Button */}
          <View style={styles.section}>
            {isStreaming ? (
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.generateButton]}
                onPress={handleGenerate}
              >
                <Text style={styles.buttonText}>Generate</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Output */}
          {(output || isStreaming) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Output {isStreaming && <ActivityIndicator size="small" />}
              </Text>
              <View style={styles.outputContainer}>
                <Text style={styles.outputText}>{output || 'Generating...'}</Text>
              </View>

              {stats.tokensPerSecond && (
                <View style={styles.statsContainer}>
                  <Text style={styles.statsText}>
                    Time to first token: {stats.promptTime?.toFixed(0)}ms
                  </Text>
                  <Text style={styles.statsText}>
                    Total time: {stats.totalTime?.toFixed(0)}ms
                  </Text>
                  <Text style={styles.statsText}>
                    Speed: {stats.tokensPerSecond?.toFixed(1)} tokens/s
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
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
  statusContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  errorText: {
    color: '#d32f2f',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  button: {
    backgroundColor: '#007aff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  halfButton: {
    flex: 1,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    marginTop: 12,
    position: 'relative',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  generateButton: {
    backgroundColor: '#34c759',
  },
  cancelButton: {
    backgroundColor: '#ff3b30',
  },
  outputContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    minHeight: 100,
  },
  outputText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  statsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  statsText: {
    fontSize: 13,
    color: '#2e7d32',
    marginBottom: 4,
  },
});
