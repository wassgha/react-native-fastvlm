import ExpoModulesCore
import CoreImage
import Foundation

public class FastVLMModule: Module {
    // The FastVLM model wrapper
    private var modelWrapper: FastVLMWrapper?

    // Track current configuration
    private var currentConfig: [String: Any]?

    public func definition() -> ModuleDefinition {
        Name("FastVLM")

        // Events that can be emitted to JavaScript
        Events(
            "onToken",
            "onDownloadProgress",
            "onModelStateChange",
            "onGenerationComplete",
            "onError"
        )

        // Initialize the module with optional configuration
        AsyncFunction("initialize") { (config: [String: Any]?) in
            self.currentConfig = config
            await MainActor.run {
                self.modelWrapper = FastVLMWrapper(
                    config: config,
                    eventEmitter: self
                )
            }
            self.sendEvent("onModelStateChange", [
                "state": "idle",
                "message": "Module initialized"
            ])
        }

        // Check if model is downloaded
        AsyncFunction("isModelDownloaded") { () -> Bool in
            return await MainActor.run {
                FastVLMWrapper.modelExists()
            }
        }

        // Download the model
        AsyncFunction("downloadModel") { (promise: Promise) in
            guard let wrapper = self.modelWrapper else {
                promise.reject(FastVLMError.notInitialized)
                return
            }

            Task {
                let success = await wrapper.download { progress, status in
                    self.sendEvent("onDownloadProgress", [
                        "progress": progress,
                        "downloadedBytes": 0,
                        "totalBytes": 0,
                        "status": status
                    ])
                }

                if success {
                    promise.resolve(true)
                } else {
                    promise.reject(FastVLMError.downloadFailed)
                }
            }
        }

        // Load the model into memory
        AsyncFunction("loadModel") { (promise: Promise) in
            guard let wrapper = self.modelWrapper else {
                promise.reject(FastVLMError.notInitialized)
                return
            }

            self.sendEvent("onModelStateChange", [
                "state": "loading",
                "message": "Loading model..."
            ])

            Task {
                do {
                    try await wrapper.load()
                    self.sendEvent("onModelStateChange", [
                        "state": "loaded",
                        "message": "Model loaded"
                    ])
                    promise.resolve(nil)
                } catch {
                    self.sendEvent("onModelStateChange", [
                        "state": "error",
                        "message": "Failed to load model",
                        "error": error.localizedDescription
                    ])
                    promise.reject(FastVLMError.loadFailed(error.localizedDescription))
                }
            }
        }

        // Unload the model from memory
        AsyncFunction("unloadModel") { () -> Bool in
            guard let wrapper = self.modelWrapper else {
                return false
            }

            let unloaded = await MainActor.run {
                wrapper.unload()
            }
            if unloaded {
                self.sendEvent("onModelStateChange", [
                    "state": "idle",
                    "message": "Model unloaded"
                ])
            }
            return unloaded
        }

        // Generate text (non-streaming)
        AsyncFunction("generate") { (input: [String: Any], params: [String: Any]?) -> [String: Any] in
            guard let wrapper = self.modelWrapper else {
                throw FastVLMError.notInitialized
            }

            let userInput = try self.parseUserInput(input)
            let generateParams = self.parseGenerateParams(params)

            let result = try await wrapper.generate(
                input: userInput,
                params: generateParams,
                stream: false,
                onToken: nil
            )

            return [
                "output": result.output,
                "promptTimeMs": result.promptTimeMs,
                "totalTimeMs": result.totalTimeMs,
                "tokenCount": result.tokenCount,
                "tokensPerSecond": result.tokensPerSecond
            ]
        }

        // Generate text with streaming
        AsyncFunction("generateStream") { (input: [String: Any], params: [String: Any]?) -> String in
            guard let wrapper = self.modelWrapper else {
                throw FastVLMError.notInitialized
            }

            let userInput = try self.parseUserInput(input)
            let generateParams = self.parseGenerateParams(params)

            // Generate unique ID for this generation
            let generationId = UUID().uuidString

            Task {
                do {
                    let result = try await wrapper.generate(
                        input: userInput,
                        params: generateParams,
                        stream: true,
                        onToken: { tokenEvent in
                            self.sendEvent("onToken", [
                                "text": tokenEvent.text,
                                "newTokens": tokenEvent.newTokens,
                                "tokenCount": tokenEvent.tokenCount,
                                "isComplete": tokenEvent.isComplete
                            ])
                        }
                    )

                    self.sendEvent("onGenerationComplete", [
                        "output": result.output,
                        "promptTimeMs": result.promptTimeMs,
                        "totalTimeMs": result.totalTimeMs,
                        "tokenCount": result.tokenCount,
                        "tokensPerSecond": result.tokensPerSecond
                    ])
                } catch {
                    self.sendEvent("onError", [
                        "error": error.localizedDescription,
                        "code": "GENERATION_FAILED"
                    ])
                }
            }

            return generationId
        }

        // Cancel current generation
        AsyncFunction("cancelGeneration") {
            await MainActor.run {
                self.modelWrapper?.cancel()
            }
        }

        // Get text embedding
        AsyncFunction("getTextEmbedding") { (text: String) -> [String: Any] in
            guard let wrapper = self.modelWrapper else {
                throw FastVLMError.notInitialized
            }

            let result = try await wrapper.getTextEmbedding(text: text)

            return [
                "embedding": result.embedding,
                "dimensions": result.dimensions
            ]
        }

        // Get image embedding
        AsyncFunction("getImageEmbedding") { (image: [String: Any]) -> [String: Any] in
            guard let wrapper = self.modelWrapper else {
                throw FastVLMError.notInitialized
            }

            let imageInput = try self.parseImageInput(image)
            let result = try await wrapper.getImageEmbedding(image: imageInput)

            return [
                "embedding": result.embedding,
                "dimensions": result.dimensions
            ]
        }

        // Get current model state
        AsyncFunction("getModelState") { () -> String in
            return await MainActor.run {
                self.modelWrapper?.getState() ?? "idle"
            }
        }

        // Check if currently generating
        AsyncFunction("isGenerating") { () -> Bool in
            return await MainActor.run {
                self.modelWrapper?.isGenerating() ?? false
            }
        }
    }

    // MARK: - Helper Methods

    private func parseUserInput(_ input: [String: Any]) throws -> UserInputData {
        guard let prompt = input["prompt"] as? String else {
            throw FastVLMError.invalidInput("Missing prompt")
        }

        var imageData: ImageInputData?
        if let image = input["image"] as? [String: Any] {
            imageData = try parseImageInput(image)
        }

        return UserInputData(prompt: prompt, image: imageData)
    }

    private func parseImageInput(_ image: [String: Any]) throws -> ImageInputData {
        if let base64 = image["base64"] as? String {
            return ImageInputData(base64: base64, uri: nil)
        } else if let uri = image["uri"] as? String {
            return ImageInputData(base64: nil, uri: uri)
        } else {
            throw FastVLMError.invalidInput("Image must have base64 or uri")
        }
    }

    private func parseGenerateParams(_ params: [String: Any]?) -> GenerateParamsData {
        guard let params = params else {
            return GenerateParamsData()
        }

        return GenerateParamsData(
            temperature: params["temperature"] as? Double ?? 0.0,
            maxTokens: params["maxTokens"] as? Int ?? 240,
            topP: params["topP"] as? Double ?? 1.0,
            seed: params["seed"] as? UInt64
        )
    }
}

// MARK: - Error Types

enum FastVLMError: Error, LocalizedError {
    case notInitialized
    case downloadFailed
    case loadFailed(String)
    case invalidInput(String)
    case generationFailed(String)
    case embeddingFailed(String)

    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "FastVLM module not initialized. Call initialize() first."
        case .downloadFailed:
            return "Failed to download the model."
        case .loadFailed(let reason):
            return "Failed to load model: \(reason)"
        case .invalidInput(let reason):
            return "Invalid input: \(reason)"
        case .generationFailed(let reason):
            return "Generation failed: \(reason)"
        case .embeddingFailed(let reason):
            return "Embedding failed: \(reason)"
        }
    }
}

// MARK: - Data Types

struct UserInputData {
    let prompt: String
    let image: ImageInputData?
}

struct ImageInputData {
    let base64: String?
    let uri: String?
}

struct GenerateParamsData {
    var temperature: Double = 0.0
    var maxTokens: Int = 240
    var topP: Double = 1.0
    var seed: UInt64?
}

struct GenerateResultData {
    let output: String
    let promptTimeMs: Double
    let totalTimeMs: Double
    let tokenCount: Int
    let tokensPerSecond: Double
}

struct TokenEventData {
    let text: String
    let newTokens: String
    let tokenCount: Int
    let isComplete: Bool
}

struct EmbeddingResultData {
    let embedding: [Double]
    let dimensions: Int
}
