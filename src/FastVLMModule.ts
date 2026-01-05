import { requireNativeModule } from 'expo-modules-core';
import type {
  GenerateParameters,
  GenerateResult,
  UserInput,
  EmbeddingResult,
  FastVLMConfig,
} from './FastVLM.types';

/**
 * Native FastVLM module interface
 */
export interface FastVLMNativeModule {
  // Lifecycle methods
  initialize(config?: FastVLMConfig): Promise<void>;
  isModelDownloaded(): Promise<boolean>;
  downloadModel(): Promise<boolean>;
  loadModel(): Promise<void>;
  unloadModel(): Promise<boolean>;

  // Generation methods
  generate(input: UserInput, params?: GenerateParameters): Promise<GenerateResult>;
  generateStream(input: UserInput, params?: GenerateParameters): Promise<string>; // Returns generation ID
  cancelGeneration(): Promise<void>;

  // Embedding methods (stretch goal)
  getTextEmbedding(text: string): Promise<EmbeddingResult>;
  getImageEmbedding(image: { base64?: string; uri?: string }): Promise<EmbeddingResult>;

  // Status methods
  getModelState(): Promise<string>;
  isGenerating(): Promise<boolean>;

  // Event emitter methods
  addListener(eventName: string, listener: (event: any) => void): { remove: () => void };
  removeListeners(count: number): void;
}

// This will throw an error if the native module is not available
export default requireNativeModule<FastVLMNativeModule>('FastVLM');
