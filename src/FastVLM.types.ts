/**
 * Types for react-native-fastvlm
 */

/**
 * Generation parameters for text generation
 */
export interface GenerateParameters {
  /** Temperature for sampling (0.0 = deterministic, higher = more random). Default: 0.0 */
  temperature?: number;
  /** Maximum number of tokens to generate. Default: 240 */
  maxTokens?: number;
  /** Top-p (nucleus) sampling parameter. Default: 1.0 */
  topP?: number;
  /** Random seed for reproducibility. If not set, uses current time */
  seed?: number;
}

/**
 * Input for text generation with optional image
 */
export interface UserInput {
  /** The text prompt to send to the model */
  prompt: string;
  /** Optional image data as base64 string or file URI */
  image?: ImageInput;
}

/**
 * Image input specification
 */
export interface ImageInput {
  /** Base64 encoded image data */
  base64?: string;
  /** Local file URI (file://) */
  uri?: string;
}

/**
 * Result from text generation
 */
export interface GenerateResult {
  /** The generated text output */
  output: string;
  /** Time to first token in milliseconds */
  promptTimeMs: number;
  /** Total generation time in milliseconds */
  totalTimeMs: number;
  /** Number of tokens generated */
  tokenCount: number;
  /** Tokens per second */
  tokensPerSecond: number;
}

/**
 * Streaming token event
 */
export interface TokenEvent {
  /** The current accumulated text */
  text: string;
  /** The new token(s) added */
  newTokens: string;
  /** Number of tokens generated so far */
  tokenCount: number;
  /** Whether this is the final token */
  isComplete: boolean;
}

/**
 * Model download progress event
 */
export interface DownloadProgressEvent {
  /** Progress from 0.0 to 1.0 */
  progress: number;
  /** Downloaded bytes */
  downloadedBytes: number;
  /** Total bytes (may be 0 if unknown) */
  totalBytes: number;
  /** Current status message */
  status: string;
}

/**
 * Model load state
 */
export type ModelState = 'idle' | 'downloading' | 'extracting' | 'loading' | 'loaded' | 'error';

/**
 * Evaluation state during generation
 */
export type EvaluationState = 'idle' | 'processingPrompt' | 'generatingResponse';

/**
 * Model info event
 */
export interface ModelInfoEvent {
  /** Current model state */
  state: ModelState;
  /** Human-readable status message */
  message: string;
  /** Error message if state is 'error' */
  error?: string;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Dimensionality of the embedding */
  dimensions: number;
}

/**
 * Events emitted by the FastVLM module
 */
export interface FastVLMEvents {
  /** Emitted when a new token is generated during streaming */
  onToken: (event: TokenEvent) => void;
  /** Emitted when download progress updates */
  onDownloadProgress: (event: DownloadProgressEvent) => void;
  /** Emitted when model state changes */
  onModelStateChange: (event: ModelInfoEvent) => void;
  /** Emitted when generation completes */
  onGenerationComplete: (event: GenerateResult) => void;
  /** Emitted when an error occurs */
  onError: (event: { error: string; code?: string }) => void;
}

/**
 * Subscription handle for event listeners
 */
export interface Subscription {
  /** Remove this event listener */
  remove: () => void;
}

/**
 * Configuration options for the FastVLM module
 */
export interface FastVLMConfig {
  /** Custom model directory path. Default: Application Support/FastVLM/model */
  modelDirectory?: string;
  /** GPU cache limit in bytes. Default: 20MB */
  gpuCacheLimit?: number;
  /** Whether to enable debug logging. Default: false */
  debug?: boolean;
}
