# react-native-fastvlm

React Native module for Apple's [FastVLM](https://github.com/apple/ml-fastvlm) vision-language model. Run state-of-the-art on-device vision AI in your React Native apps.

## Features

- **On-device inference** - Run FastVLM entirely on-device using Apple's MLX framework
- **Vision + Language** - Analyze images and generate text responses
- **Token streaming** - Get real-time streaming of generated tokens
- **Embeddings** - Generate text and image embeddings for similarity search
- **Expo compatible** - Built as an Expo module for easy integration

## Requirements

- iOS 17.0+
- Apple Silicon device (iPhone 12+ / iPad with M1+ / Apple Silicon Mac)
- Expo SDK 52+

## Installation

```bash
npm install react-native-fastvlm
# or
yarn add react-native-fastvlm
```

For Expo projects, run:

```bash
npx expo prebuild
```

### iOS Setup - Adding MLX Swift Packages

The MLX framework is distributed via Swift Package Manager (SPM), not CocoaPods. After running `expo prebuild`, you need to manually add the required packages to your Xcode project.

**Prerequisites**: Download the Metal toolchain (required for MLX compilation):

```bash
xcodebuild -downloadComponent MetalToolchain
```

1. Open your iOS project in Xcode:
   ```bash
   open ios/YourApp.xcworkspace
   ```

2. In Xcode, go to **File → Add Package Dependencies...**

3. Add the following packages:

   | Package URL | Version |
   |-------------|---------|
   | `https://github.com/ml-explore/mlx-swift` | 0.21.0+ |
   | `https://github.com/ml-explore/mlx-swift-examples` | 0.21.0+ |

4. When prompted, add these libraries to your app target:
   - `MLX`
   - `MLXRandom`
   - `MLXNN`
   - `MLXOptimizers`
   - `MLXFFT`
   - `MLXLinalg`
   - `Cmlx`
   - `LLM` (from mlx-swift-examples)
   - `MLXVLM` (from mlx-swift-examples)
   - `MLXLMCommon` (from mlx-swift-examples)

5. Build and run your project

## Quick Start

```typescript
import { FastVLM } from 'react-native-fastvlm';

// Initialize the module
await FastVLM.initialize();

// Download the model (~500MB, first time only)
if (!await FastVLM.isModelDownloaded()) {
  await FastVLM.downloadModel();
}

// Load the model into memory
await FastVLM.loadModel();

// Generate text from an image
const result = await FastVLM.generate({
  prompt: "What do you see in this image?",
  image: { uri: "file:///path/to/image.jpg" }
});

console.log(result.output);
```

## API Reference

### Initialization

#### `FastVLM.initialize(config?)`

Initialize the FastVLM module with optional configuration.

```typescript
await FastVLM.initialize({
  gpuCacheLimit: 20 * 1024 * 1024, // 20MB GPU cache
  debug: false
});
```

#### `FastVLM.isModelDownloaded()`

Check if the model has been downloaded.

```typescript
const downloaded = await FastVLM.isModelDownloaded();
```

#### `FastVLM.downloadModel()`

Download the FastVLM model. Subscribe to `onDownloadProgress` for progress updates.

```typescript
// Set up progress listener
const subscription = FastVLM.addDownloadProgressListener((event) => {
  console.log(`Download: ${Math.round(event.progress * 100)}%`);
});

await FastVLM.downloadModel();
subscription.remove();
```

#### `FastVLM.loadModel()`

Load the model into memory. Must be called before generation.

```typescript
await FastVLM.loadModel();
```

#### `FastVLM.unloadModel()`

Unload the model from memory to free resources.

```typescript
const wasUnloaded = await FastVLM.unloadModel();
```

### Text Generation

#### `FastVLM.generate(input, params?)`

Generate text from a prompt and optional image. Returns when generation is complete.

```typescript
const result = await FastVLM.generate(
  {
    prompt: "Describe this image",
    image: { uri: "file:///path/to/image.jpg" }
    // or: image: { base64: "..." }
  },
  {
    temperature: 0.0,    // 0.0 = deterministic
    maxTokens: 240,      // Maximum tokens to generate
    topP: 1.0,           // Nucleus sampling
    seed: 12345          // For reproducibility
  }
);

console.log(result.output);           // Generated text
console.log(result.promptTimeMs);     // Time to first token
console.log(result.totalTimeMs);      // Total generation time
console.log(result.tokensPerSecond);  // Generation speed
```

#### `FastVLM.generateStream(input, params?)`

Generate text with streaming tokens. Subscribe to `onToken` for real-time updates.

```typescript
// Set up token listener
const subscription = FastVLM.addTokenListener((event) => {
  console.log('Current text:', event.text);
  console.log('New tokens:', event.newTokens);
  console.log('Token count:', event.tokenCount);

  if (event.isComplete) {
    console.log('Generation complete!');
  }
});

// Start streaming generation
await FastVLM.generateStream({
  prompt: "Tell me a story about this image",
  image: { uri: imageUri }
});

// Clean up when done
subscription.remove();
```

#### `FastVLM.cancelGeneration()`

Cancel the current generation.

```typescript
await FastVLM.cancelGeneration();
```

### Embeddings

#### `FastVLM.getTextEmbedding(text)`

Get embedding vector for text.

```typescript
const result = await FastVLM.getTextEmbedding("Hello world");
console.log(result.embedding);    // number[]
console.log(result.dimensions);   // e.g., 768
```

#### `FastVLM.getImageEmbedding(image)`

Get embedding vector for an image.

```typescript
const result = await FastVLM.getImageEmbedding({
  uri: "file:///path/to/image.jpg"
});
console.log(result.embedding);
```

### Event Listeners

All event listeners return a `Subscription` object with a `remove()` method.

```typescript
// Token streaming
FastVLM.addTokenListener((event: TokenEvent) => { ... });

// Download progress
FastVLM.addDownloadProgressListener((event: DownloadProgressEvent) => { ... });

// Model state changes
FastVLM.addModelStateListener((event: ModelInfoEvent) => { ... });

// Generation complete
FastVLM.addGenerationCompleteListener((event: GenerateResult) => { ... });

// Errors
FastVLM.addErrorListener((event: { error: string, code?: string }) => { ... });
```

### Status Methods

```typescript
// Get current model state: 'idle' | 'downloading' | 'loading' | 'loaded' | 'error'
const state = await FastVLM.getModelState();

// Check if generation is in progress
const generating = await FastVLM.isGenerating();
```

## Types

```typescript
interface UserInput {
  prompt: string;
  image?: ImageInput;
}

interface ImageInput {
  base64?: string;  // Base64 encoded image
  uri?: string;     // Local file URI
}

interface GenerateParameters {
  temperature?: number;  // Default: 0.0
  maxTokens?: number;    // Default: 240
  topP?: number;         // Default: 1.0
  seed?: number;         // Random seed
}

interface GenerateResult {
  output: string;
  promptTimeMs: number;
  totalTimeMs: number;
  tokenCount: number;
  tokensPerSecond: number;
}

interface TokenEvent {
  text: string;
  newTokens: string;
  tokenCount: number;
  isComplete: boolean;
}

interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}
```

## Example App

See the `example/` directory for a complete working example with:
- Model download with progress
- Image selection from library or camera
- Streaming text generation
- Performance statistics

To run the example:

```bash
cd example
npm install
npx expo prebuild
npx expo run:ios
```

## Performance Tips

1. **Model Loading**: Load the model once at app startup and keep it in memory
2. **Unload on Memory Pressure**: Call `unloadModel()` when receiving memory warnings
3. **Image Size**: The model resizes images internally, but smaller images process faster
4. **Streaming**: Use streaming for better UX - users see results as they generate

## License

MIT

## Credits

- [Apple FastVLM](https://github.com/apple/ml-fastvlm) - The underlying vision-language model
- [MLX Swift](https://github.com/ml-explore/mlx-swift) - Apple's ML framework for Swift
