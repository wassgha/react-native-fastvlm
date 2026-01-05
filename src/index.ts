import FastVLMModule from './FastVLMModule';
import type {
  GenerateParameters,
  GenerateResult,
  UserInput,
  TokenEvent,
  DownloadProgressEvent,
  ModelInfoEvent,
  EmbeddingResult,
  FastVLMConfig,
  FastVLMEvents,
  ImageInput,
  Subscription,
} from './FastVLM.types';

// Re-export types
export * from './FastVLM.types';

// Export React hook
export { useFastVLM } from './useFastVLM';
export type { UseFastVLMReturn, UseFastVLMOptions, ModelStatus } from './useFastVLM';

/**
 * FastVLM - React Native module for Apple's FastVLM vision-language model
 *
 * @example
 * ```typescript
 * import { FastVLM } from 'react-native-fastvlm';
 *
 * // Initialize and load the model
 * await FastVLM.initialize();
 * if (!await FastVLM.isModelDownloaded()) {
 *   await FastVLM.downloadModel();
 * }
 * await FastVLM.loadModel();
 *
 * // Generate text from an image
 * const result = await FastVLM.generate({
 *   prompt: "What do you see in this image?",
 *   image: { uri: "file:///path/to/image.jpg" }
 * });
 * console.log(result.output);
 * ```
 */
export const FastVLM = {
  /**
   * Initialize the FastVLM module with optional configuration
   * @param config Optional configuration options
   */
  async initialize(config?: FastVLMConfig): Promise<void> {
    return FastVLMModule.initialize(config);
  },

  /**
   * Check if the model has been downloaded
   * @returns true if the model exists locally
   */
  async isModelDownloaded(): Promise<boolean> {
    return FastVLMModule.isModelDownloaded();
  },

  /**
   * Download the FastVLM model
   * Subscribe to 'onDownloadProgress' events to track progress
   * @returns true if download was successful
   */
  async downloadModel(): Promise<boolean> {
    return FastVLMModule.downloadModel();
  },

  /**
   * Load the model into memory
   * This must be called after downloading before generation
   */
  async loadModel(): Promise<void> {
    return FastVLMModule.loadModel();
  },

  /**
   * Unload the model from memory to free resources
   * @returns true if a model was unloaded
   */
  async unloadModel(): Promise<boolean> {
    return FastVLMModule.unloadModel();
  },

  /**
   * Generate text from a prompt and optional image
   * This is a non-streaming method that returns when generation is complete
   *
   * @param input The prompt and optional image
   * @param params Optional generation parameters
   * @returns The generation result with output text and statistics
   *
   * @example
   * ```typescript
   * const result = await FastVLM.generate({
   *   prompt: "Describe this image",
   *   image: { uri: "file:///path/to/image.jpg" }
   * });
   * ```
   */
  async generate(input: UserInput, params?: GenerateParameters): Promise<GenerateResult> {
    return FastVLMModule.generate(input, params);
  },

  /**
   * Generate text with streaming tokens
   * Subscribe to 'onToken' events to receive tokens as they are generated
   *
   * @param input The prompt and optional image
   * @param params Optional generation parameters
   * @returns A generation ID that can be used to cancel
   *
   * @example
   * ```typescript
   * // Set up token listener
   * const subscription = FastVLM.addTokenListener((event) => {
   *   console.log('New text:', event.text);
   * });
   *
   * // Start streaming generation
   * await FastVLM.generateStream({
   *   prompt: "Tell me a story",
   *   image: { base64: imageBase64 }
   * });
   *
   * // Clean up
   * subscription.remove();
   * ```
   */
  async generateStream(input: UserInput, params?: GenerateParameters): Promise<string> {
    return FastVLMModule.generateStream(input, params);
  },

  /**
   * Cancel the current generation
   */
  async cancelGeneration(): Promise<void> {
    return FastVLMModule.cancelGeneration();
  },

  /**
   * Get text embeddings for a given text
   * @param text The text to embed
   * @returns The embedding result with vector and dimensions
   */
  async getTextEmbedding(text: string): Promise<EmbeddingResult> {
    return FastVLMModule.getTextEmbedding(text);
  },

  /**
   * Get image embeddings for a given image
   * @param image The image to embed (base64 or URI)
   * @returns The embedding result with vector and dimensions
   */
  async getImageEmbedding(image: ImageInput): Promise<EmbeddingResult> {
    return FastVLMModule.getImageEmbedding(image);
  },

  /**
   * Get the current model state
   * @returns The current model state
   */
  async getModelState(): Promise<string> {
    return FastVLMModule.getModelState();
  },

  /**
   * Check if generation is currently in progress
   * @returns true if currently generating
   */
  async isGenerating(): Promise<boolean> {
    return FastVLMModule.isGenerating();
  },

  // Event subscription methods

  /**
   * Add a listener for streaming tokens during generation
   * @param listener Callback function for token events
   * @returns Subscription that can be removed
   */
  addTokenListener(listener: FastVLMEvents['onToken']): Subscription {
    return FastVLMModule.addListener('onToken', listener);
  },

  /**
   * Add a listener for model download progress
   * @param listener Callback function for download progress events
   * @returns Subscription that can be removed
   */
  addDownloadProgressListener(listener: FastVLMEvents['onDownloadProgress']): Subscription {
    return FastVLMModule.addListener('onDownloadProgress', listener);
  },

  /**
   * Add a listener for model state changes
   * @param listener Callback function for model state events
   * @returns Subscription that can be removed
   */
  addModelStateListener(listener: FastVLMEvents['onModelStateChange']): Subscription {
    return FastVLMModule.addListener('onModelStateChange', listener);
  },

  /**
   * Add a listener for generation completion
   * @param listener Callback function for generation complete events
   * @returns Subscription that can be removed
   */
  addGenerationCompleteListener(listener: FastVLMEvents['onGenerationComplete']): Subscription {
    return FastVLMModule.addListener('onGenerationComplete', listener);
  },

  /**
   * Add a listener for errors
   * @param listener Callback function for error events
   * @returns Subscription that can be removed
   */
  addErrorListener(listener: FastVLMEvents['onError']): Subscription {
    return FastVLMModule.addListener('onError', listener);
  },
};

// Default export
export default FastVLM;
