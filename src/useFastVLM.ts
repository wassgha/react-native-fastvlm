import { useState, useEffect, useCallback, useRef } from 'react';
import FastVLMModule from './FastVLMModule';
import type {
  GenerateResult,
  TokenEvent,
  DownloadProgressEvent,
  ModelInfoEvent,
  UserInput,
  GenerateParameters,
  Subscription,
} from './FastVLM.types';

export type ModelStatus =
  | 'initializing'
  | 'not_downloaded'
  | 'downloading'
  | 'ready'
  | 'loading'
  | 'generating'
  | 'error';

export interface UseFastVLMOptions {
  autoInitialize?: boolean;
  autoLoad?: boolean;
}

export interface UseFastVLMReturn {
  status: ModelStatus;
  downloadProgress: number;
  output: string;
  isGenerating: boolean;
  error: string | null;
  stats: {
    promptTimeMs?: number;
    totalTimeMs?: number;
    tokensPerSecond?: number;
    tokenCount?: number;
  };

  initialize: () => Promise<void>;
  download: () => Promise<boolean>;
  load: () => Promise<void>;
  unload: () => Promise<boolean>;
  generate: (input: UserInput, params?: GenerateParameters) => Promise<GenerateResult>;
  generateStream: (input: UserInput, params?: GenerateParameters) => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * React hook for using FastVLM in functional components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     status,
 *     output,
 *     isGenerating,
 *     download,
 *     load,
 *     generateStream,
 *   } = useFastVLM({ autoInitialize: true });
 *
 *   if (status === 'not_downloaded') {
 *     return <Button onPress={download}>Download Model</Button>;
 *   }
 *
 *   return (
 *     <View>
 *       <Text>{output}</Text>
 *       <Button
 *         onPress={() => generateStream({ prompt: "Hello!" })}
 *         disabled={isGenerating}
 *       >
 *         Generate
 *       </Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useFastVLM(options: UseFastVLMOptions = {}): UseFastVLMReturn {
  const { autoInitialize = true, autoLoad = false } = options;

  const [status, setStatus] = useState<ModelStatus>('initializing');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UseFastVLMReturn['stats']>({});

  const subscriptionsRef = useRef<Subscription[]>([]);

  // Set up event listeners
  useEffect(() => {
    const subs: Subscription[] = [];

    subs.push(
      FastVLMModule.addListener('onToken', (event: TokenEvent) => {
        setOutput(event.text);
        if (event.isComplete) {
          setIsGenerating(false);
        }
      })
    );

    subs.push(
      FastVLMModule.addListener('onDownloadProgress', (event: DownloadProgressEvent) => {
        setDownloadProgress(event.progress);
      })
    );

    subs.push(
      FastVLMModule.addListener('onModelStateChange', (event: ModelInfoEvent) => {
        if (event.state === 'error') {
          setError(event.error ?? event.message);
          setStatus('error');
        }
      })
    );

    subs.push(
      FastVLMModule.addListener('onGenerationComplete', (event: GenerateResult) => {
        setStats({
          promptTimeMs: event.promptTimeMs,
          totalTimeMs: event.totalTimeMs,
          tokensPerSecond: event.tokensPerSecond,
          tokenCount: event.tokenCount,
        });
        setIsGenerating(false);
        setStatus('ready');
      })
    );

    subs.push(
      FastVLMModule.addListener('onError', (event: { error: string }) => {
        setError(event.error);
        setIsGenerating(false);
      })
    );

    subscriptionsRef.current = subs;

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, []);

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize]);

  const initialize = useCallback(async () => {
    try {
      setStatus('initializing');
      setError(null);
      await FastVLMModule.initialize();

      const downloaded = await FastVLMModule.isModelDownloaded();
      if (downloaded) {
        if (autoLoad) {
          await load();
        } else {
          setStatus('ready');
        }
      } else {
        setStatus('not_downloaded');
      }
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  }, [autoLoad]);

  const download = useCallback(async () => {
    try {
      setStatus('downloading');
      setDownloadProgress(0);
      setError(null);

      const success = await FastVLMModule.downloadModel();
      if (success) {
        await FastVLMModule.loadModel();
        setStatus('ready');
        return true;
      } else {
        setStatus('error');
        setError('Download failed');
        return false;
      }
    } catch (err) {
      setError(String(err));
      setStatus('error');
      return false;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setStatus('loading');
      setError(null);
      await FastVLMModule.loadModel();
      setStatus('ready');
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  }, []);

  const unload = useCallback(async () => {
    try {
      const unloaded = await FastVLMModule.unloadModel();
      if (unloaded) {
        setStatus('not_downloaded');
      }
      return unloaded;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  const generate = useCallback(
    async (input: UserInput, params?: GenerateParameters) => {
      try {
        setStatus('generating');
        setIsGenerating(true);
        setOutput('');
        setStats({});
        setError(null);

        const result = await FastVLMModule.generate(input, params);

        setOutput(result.output);
        setStats({
          promptTimeMs: result.promptTimeMs,
          totalTimeMs: result.totalTimeMs,
          tokensPerSecond: result.tokensPerSecond,
          tokenCount: result.tokenCount,
        });
        setStatus('ready');
        setIsGenerating(false);

        return result;
      } catch (err) {
        setError(String(err));
        setStatus('ready');
        setIsGenerating(false);
        throw err;
      }
    },
    []
  );

  const generateStream = useCallback(
    async (input: UserInput, params?: GenerateParameters) => {
      try {
        setStatus('generating');
        setIsGenerating(true);
        setOutput('');
        setStats({});
        setError(null);

        await FastVLMModule.generateStream(input, params);
      } catch (err) {
        setError(String(err));
        setStatus('ready');
        setIsGenerating(false);
        throw err;
      }
    },
    []
  );

  const cancel = useCallback(async () => {
    await FastVLMModule.cancelGeneration();
    setIsGenerating(false);
    setStatus('ready');
  }, []);

  return {
    status,
    downloadProgress,
    output,
    isGenerating,
    error,
    stats,
    initialize,
    download,
    load,
    unload,
    generate,
    generateStream,
    cancel,
  };
}

export default useFastVLM;
