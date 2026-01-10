import Foundation
import CoreImage
import ExpoModulesCore

#if canImport(FastVLM)
import FastVLM
#endif

#if canImport(MLX)
import MLX
#endif

#if canImport(MLXLMCommon)
import MLXLMCommon
#endif

#if canImport(MLXRandom)
import MLXRandom
#endif

#if canImport(MLXVLM)
import MLXVLM
#endif

#if canImport(ZIPFoundation)
import ZIPFoundation
#endif

/// Wrapper class for FastVLM model operations
@MainActor
class FastVLMWrapper {
    // MARK: - Properties

    private weak var eventEmitter: FastVLMModule?
    private var config: [String: Any]?

    private var running = false
    private var modelInfo = ""
    private var output = ""

    enum LoadState {
        case idle
        case loaded(Any) // ModelContainer when FastVLM is available
    }

    private var loadState = LoadState.idle
    private var currentTask: Task<Void, Never>?

    enum State: String {
        case idle = "idle"
        case downloading = "downloading"
        case extracting = "extracting"
        case loading = "loading"
        case loaded = "loaded"
        case error = "error"
    }

    private var state = State.idle

    // Model configuration
    private var modelDirectory: URL {
        if let customPath = config?["modelPath"] as? String {
            return URL(fileURLWithPath: customPath)
        }
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return support.appendingPathComponent("FastVLM/model", isDirectory: true)
    }

    private let modelIdentifier = "llava-fastvithd_0.5b_stage3_llm.fp16"
    private var modelDownloadURL: URL {
        URL(string: "https://ml-site.cdn-apple.com/datasets/fastvlm/\(modelIdentifier).zip")!
    }

    // Generation parameters
    private let displayEveryNTokens = 4

    // MARK: - Initialization

    init(config: [String: Any]?, eventEmitter: FastVLMModule) {
        self.config = config
        self.eventEmitter = eventEmitter

        // Register FastVLM with the model factory
        #if canImport(FastVLM) && canImport(MLXVLM)
        FastVLM.register(modelFactory: VLMModelFactory.shared)
        #endif
    }

    // MARK: - Static Methods

    static func modelExists() -> Bool {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let config = support.appendingPathComponent("FastVLM/model/config.json")
        return FileManager.default.fileExists(atPath: config.path)
    }

    // MARK: - State Management

    func getState() -> String {
        return state.rawValue
    }

    func isGenerating() -> Bool {
        return running
    }

    // MARK: - Download

    func download(progressHandler: @escaping (Double, String) -> Void) async -> Bool {
        state = .downloading
        progressHandler(0, "Downloading...")

        print("[FastVLM] Starting model download from \(modelDownloadURL.absoluteString)")

        do {
            try await ensureModelAvailable(progressHandler: progressHandler)
            progressHandler(1.0, "Download complete")
            print("[FastVLM] Model download and extraction finished")
            return true
        } catch {
            print("[FastVLM] Model download failed: \(error.localizedDescription)")
            state = .error
            return false
        }
    }

    private func ensureModelAvailable(progressHandler: @escaping (Double, String) -> Void) async throws {
        let configURL = modelDirectory.appendingPathComponent("config.json")
        if FileManager.default.fileExists(atPath: configURL.path) { return }

        let fm = FileManager.default
        try fm.createDirectory(at: modelDirectory, withIntermediateDirectories: true)

        // Temporary workspace
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: tempDir) }

        // Download to a file while reporting progress
        let zipURL = tempDir.appendingPathComponent("model.zip")
        try await downloadFile(from: modelDownloadURL, to: zipURL, progressHandler: progressHandler)

        print("[FastVLM] Downloaded archive to \(zipURL.path)")

        state = .extracting
        progressHandler(0, "Extracting 0%")
        print("[FastVLM] Extracting archive...")

        try await unzipItem(at: zipURL, to: tempDir) { progress in
            print(String(format: "[FastVLM] Extraction progress: %.0f%%", progress * 100))
            progressHandler(progress, "Extracting \(Int(progress * 100))%")
        }

        print("[FastVLM] Extraction complete")
        progressHandler(1.0, "Finalizing...")

        // Copy extracted contents to modelDirectory
        let extractedRoot = tempDir.appendingPathComponent(modelIdentifier, isDirectory: true)
        let files = try fm.contentsOfDirectory(at: extractedRoot, includingPropertiesForKeys: nil)
        for file in files {
            let dest = modelDirectory.appendingPathComponent(file.lastPathComponent)
            if fm.fileExists(atPath: dest.path) {
                try fm.removeItem(at: dest)
            }
            try fm.moveItem(at: file, to: dest)
        }
        print("[FastVLM] Copied model files to cache at \(modelDirectory.path)")
    }

    private func downloadFile(from url: URL, to destination: URL, progressHandler: @escaping (Double, String) -> Void) async throws {
        let downloader = ModelDownloader()
        let tempURL = try await downloader.download(url: url) { progress in
            let msg = String(format: "Downloading %d%%", Int(progress * 100))
            progressHandler(progress, msg)
        }
        
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: tempURL, to: destination)
    }

    private func unzipItem(at sourceURL: URL, to destinationURL: URL, progressHandler: @escaping (Double) -> Void) async throws {
        #if canImport(ZIPFoundation)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let fileManager = FileManager.default
                    let archive = try Archive(url: sourceURL, accessMode: .read)
                    let entries = Array(archive)
                    let total = entries.count

                    for (index, entry) in entries.enumerated() {
                        let entryURL = destinationURL.appendingPathComponent(entry.path)
                        try fileManager.createDirectory(
                            at: entryURL.deletingLastPathComponent(),
                            withIntermediateDirectories: true
                        )
                        _ = try archive.extract(entry, to: entryURL)

                        Task { @MainActor in
                            progressHandler(Double(index + 1) / Double(total))
                        }
                    }
                    print("[FastVLM] Unzipped archive using ZIPFoundation")
                    continuation.resume(returning: ())
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
        #else
        // ZIPFoundation not available - use built-in unzipping via FileManager
        // iOS doesn't have Process class, so we use a simpler approach
        print("[FastVLM] ZIPFoundation not available, using fallback unzip")

        // Use SSZipArchive-style approach or throw error
        throw NSError(
            domain: "FastVLMWrapper",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "ZIPFoundation is required for model extraction. Please add ZIPFoundation to your project."]
        )
        #endif
    }

    // MARK: - Load/Unload

    func load() async throws {
        state = .loading

        #if canImport(FastVLM) && canImport(MLX) && canImport(MLXVLM)
        switch loadState {
        case .idle:
            // Limit the buffer cache
            let cacheLimit = config?["gpuCacheLimit"] as? Int ?? 20 * 1024 * 1024
            MLX.GPU.set(cacheLimit: cacheLimit)

            try await ensureModelAvailable { _, _ in }

            let modelContainer = try await VLMModelFactory.shared.loadContainer(
                configuration: FastVLM.modelConfiguration
            ) { progress in
                print("[FastVLM] Loading model: \(Int(progress.fractionCompleted * 100))%")
            }

            loadState = .loaded(modelContainer)
            state = .loaded
            modelInfo = "Loaded"

        case .loaded:
            // Already loaded
            break
        }
        #else
        // FastVLM not available - throw error
        throw FastVLMError.loadFailed("FastVLM framework not available")
        #endif
    }

    func unload() -> Bool {
        currentTask?.cancel()
        currentTask = nil
        running = false

        switch loadState {
        case .idle:
            return false
        case .loaded:
            print("[FastVLM] Unloading cached model to free memory.")
            loadState = .idle
            state = .idle
            modelInfo = "Unloaded"
            return true
        }
    }

    // MARK: - Generation

    func generate(
        input: UserInputData,
        params: GenerateParamsData,
        stream: Bool,
        onToken: ((TokenEventData) -> Void)?
    ) async throws -> GenerateResultData {
        #if canImport(FastVLM) && canImport(MLX) && canImport(MLXLMCommon) && canImport(MLXVLM)
        guard case .loaded(let container) = loadState,
              let modelContainer = container as? ModelContainer else {
            throw FastVLMError.notInitialized
        }

        if running {
            throw FastVLMError.generationFailed("Generation already in progress")
        }

        running = true
        output = ""

        let startTime = Date()
        var promptTimeMs: Double = 0
        var tokenCount = 0

        // Seed random generator
        if let seed = params.seed {
            MLXRandom.seed(seed)
        } else {
            MLXRandom.seed(UInt64(Date.timeIntervalSinceReferenceDate * 1000))
        }

        // Create generate parameters
        let generateParameters = GenerateParameters(temperature: Float(params.temperature))

        // Prepare user input
        let userInput = try await prepareUserInput(input: input)

        // Perform generation
        let result = try await modelContainer.perform { context in
            let llmStart = Date()
            let preparedInput = try await context.processor.prepare(input: userInput)

            var seenFirstToken = false
            var lastText = ""

            let genResult = try MLXLMCommon.generate(
                input: preparedInput,
                parameters: generateParameters,
                context: context
            ) { tokens in
                tokenCount = tokens.count

                if !seenFirstToken {
                    seenFirstToken = true
                    promptTimeMs = Date().timeIntervalSince(llmStart) * 1000
                    let text = context.tokenizer.decode(tokens: tokens)
                    lastText = text

                    if stream {
                        onToken?(TokenEventData(
                            text: text,
                            newTokens: text,
                            tokenCount: tokens.count,
                            isComplete: false
                        ))
                    }
                }

                if stream && tokens.count % self.displayEveryNTokens == 0 {
                    let text = context.tokenizer.decode(tokens: tokens)
                    let newTokens = String(text.dropFirst(lastText.count))
                    lastText = text

                    onToken?(TokenEventData(
                        text: text,
                        newTokens: newTokens,
                        tokenCount: tokens.count,
                        isComplete: false
                    ))
                }

                if tokens.count >= params.maxTokens {
                    return .stop
                } else {
                    return .more
                }
            }

            return genResult
        }

        let totalTimeMs = Date().timeIntervalSince(startTime) * 1000
        let tokensPerSecond = totalTimeMs > 0 ? Double(tokenCount) / (totalTimeMs / 1000) : 0

        output = result.output

        // Send final token event
        if stream {
            onToken?(TokenEventData(
                text: result.output,
                newTokens: "",
                tokenCount: tokenCount,
                isComplete: true
            ))
        }

        running = false

        return GenerateResultData(
            output: result.output,
            promptTimeMs: promptTimeMs,
            totalTimeMs: totalTimeMs,
            tokenCount: tokenCount,
            tokensPerSecond: tokensPerSecond
        )
        #else
        throw FastVLMError.generationFailed("FastVLM framework not available")
        #endif
    }

    #if canImport(MLXLMCommon)
    private func prepareUserInput(input: UserInputData) async throws -> UserInput {
        var images: [UserInput.Image] = []

        if let imageInput = input.image {
            if let base64 = imageInput.base64,
               let data = Data(base64Encoded: base64),
               let ciImage = CIImage(data: data) {
                images.append(.ciImage(ciImage))
            } else if let uri = imageInput.uri,
                      let url = URL(string: uri) {
                // Handle file URL
                if url.isFileURL {
                    let data = try Data(contentsOf: url)
                    if let ciImage = CIImage(data: data) {
                        images.append(.ciImage(ciImage))
                    }
                } else {
                    // Handle remote URL
                    let (data, _) = try await URLSession.shared.data(from: url)
                    if let ciImage = CIImage(data: data) {
                        images.append(.ciImage(ciImage))
                    }
                }
            }
        }

        return UserInput(
            prompt: input.prompt,
            images: images
        )
    }
    #endif

    func cancel() {
        currentTask?.cancel()
        currentTask = nil
        running = false
        output = ""
    }

    // MARK: - Embeddings

    func getTextEmbedding(text: String) async throws -> EmbeddingResultData {
        #if canImport(FastVLM) && canImport(MLX) && canImport(MLXLMCommon) && canImport(MLXVLM)
        guard case .loaded(let container) = loadState,
              let modelContainer = container as? ModelContainer else {
            throw FastVLMError.notInitialized
        }

        // Get text embeddings from the language model
        let embedding = try await modelContainer.perform { context in
            // Tokenize the text
            let tokens = context.tokenizer.encode(text: text)
            let tokenArray = MLXArray(tokens)

            // Get embeddings from the model
            // Note: This is a simplified implementation - actual embedding extraction
            // may need to access internal model layers
            guard let model = context.model as? any EmbeddingProvider else {
                throw FastVLMError.embeddingFailed("Model does not support embeddings")
            }

            let embeddings = model.getEmbeddings(for: tokenArray)

            // Mean pool the embeddings
            let pooled = embeddings.mean(axis: 0)
            return pooled.asArray(Double.self)
        }

        return EmbeddingResultData(
            embedding: embedding,
            dimensions: embedding.count
        )
        #else
        throw FastVLMError.embeddingFailed("FastVLM framework not available")
        #endif
    }

    func getImageEmbedding(image: ImageInputData) async throws -> EmbeddingResultData {
        #if canImport(FastVLM) && canImport(MLX) && canImport(MLXLMCommon) && canImport(MLXVLM)
        guard case .loaded(let container) = loadState,
              let modelContainer = container as? ModelContainer else {
            throw FastVLMError.notInitialized
        }

        // Load image
        var ciImage: CIImage?

        if let base64 = image.base64,
           let data = Data(base64Encoded: base64) {
            ciImage = CIImage(data: data)
        } else if let uri = image.uri,
                  let url = URL(string: uri) {
            if url.isFileURL {
                let data = try Data(contentsOf: url)
                ciImage = CIImage(data: data)
            } else {
                let (data, _) = try await URLSession.shared.data(from: url)
                ciImage = CIImage(data: data)
            }
        }

        guard let image = ciImage else {
            throw FastVLMError.invalidInput("Could not load image")
        }

        // Get image embeddings from the vision model
        let embedding = try await modelContainer.perform { context in
            guard let model = context.model as? any VisionEmbeddingProvider else {
                throw FastVLMError.embeddingFailed("Model does not support vision embeddings")
            }

            let embeddings = try model.getVisionEmbeddings(for: image)
            let pooled = embeddings.mean(axis: 0)
            return pooled.asArray(Double.self)
        }

        return EmbeddingResultData(
            embedding: embedding,
            dimensions: embedding.count
        )
        #else
        throw FastVLMError.embeddingFailed("FastVLM framework not available")
        #endif
    }
}

// MARK: - Protocols for Embedding Support

#if canImport(MLX)
protocol EmbeddingProvider {
    func getEmbeddings(for tokens: MLXArray) -> MLXArray
}

protocol VisionEmbeddingProvider {
    func getVisionEmbeddings(for image: CIImage) throws -> MLXArray
}
#endif

// MARK: - Downloader Helper
class ModelDownloader: NSObject, URLSessionDownloadDelegate {
    private var continuation: CheckedContinuation<URL, Error>?
    private var progressHandler: ((Double) -> Void)?

    func download(url: URL, progress: @escaping (Double) -> Void) async throws -> URL {
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            self.progressHandler = progress
            
            let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
            let task = session.downloadTask(with: url)
            task.resume()
        }
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.moveItem(at: location, to: dest)
            continuation?.resume(returning: dest)
        } catch {
            continuation?.resume(throwing: error)
        }
        continuation = nil
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let p = totalBytesExpectedToWrite > 0 ? Double(totalBytesWritten) / Double(totalBytesExpectedToWrite) : 0
        progressHandler?(p)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            continuation?.resume(throwing: error)
            continuation = nil
        }
        session.finishTasksAndInvalidate()
    }
}
