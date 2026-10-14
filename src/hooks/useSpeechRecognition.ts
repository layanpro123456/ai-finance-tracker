import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API Types
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: {
      readonly isFinal: boolean;
      readonly length: number;
      [index: number]: {
        readonly transcript: string;
        readonly confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export interface SupportedVoiceLanguage {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_VOICE_LANGUAGES: SupportedVoiceLanguage[] = [
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'en-AU', label: 'English (Australia)', flag: '🇦🇺' },
  { code: 'en-CA', label: 'English (Canada)', flag: '🇨🇦' },
  { code: 'es-ES', label: 'Español (España)', flag: '🇪🇸' },
  { code: 'es-MX', label: 'Español (México)', flag: '🇲🇽' },
  { code: 'fr-FR', label: 'Français (France)', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'ja-JP', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'zh-CN', label: '中文 (Mandarin)', flag: '🇨🇳' },
  { code: 'si-LK', label: 'සිංහල (Sinhala)', flag: '🇱🇰' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'ar-SA', label: 'العربية (Arabic)', flag: '🇸🇦' },
];

export interface UseSpeechRecognitionOptions {
  defaultLang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: (finalTranscript: string) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  startListening: (overrideLang?: string) => void;
  stopListening: () => void;
  resetTranscript: () => void;
  clearError: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Default to navigator language or en-US
  const [language, setLanguage] = useState<string>(() => {
    if (options.defaultLang) return options.defaultLang;
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    return 'en-US';
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fullTranscriptRef = useRef<string>('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSupport =
        'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      setIsSupported(Boolean(hasSupport));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    fullTranscriptRef.current = '';
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (overrideLang?: string) => {
      setError(null);
      setInterimTranscript('');

      if (typeof window === 'undefined') return;

      const SpeechRecognitionClass = (
        (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
      );

      if (!SpeechRecognitionClass) {
        setError('Voice typing is not supported in this browser. Please use Chrome, Edge, Safari, or a modern mobile browser.');
        return;
      }

      // Stop existing instance if any
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = optionsRef.current.continuous ?? false;
        recognition.interimResults = optionsRef.current.interimResults ?? true;
        recognition.lang = overrideLang || language;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let liveInterim = '';
          let liveFinal = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            const text = item[0]?.transcript || '';
            if (item.isFinal) {
              liveFinal += text;
            } else {
              liveInterim += text;
            }
          }

          if (liveFinal) {
            const trimmed = liveFinal.trim();
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${trimmed}` : trimmed;
              fullTranscriptRef.current = updated;
              optionsRef.current.onResult?.(updated, true);
              return updated;
            });
          }

          setInterimTranscript(liveInterim);
          if (liveInterim) {
            optionsRef.current.onResult?.(liveInterim, false);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          let message = 'Speech recognition error.';
          switch (event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
              message = 'Microphone access blocked. Please allow microphone permission in your browser address bar.';
              break;
            case 'no-speech':
              message = 'No speech detected. Please speak closer to your microphone.';
              break;
            case 'audio-capture':
              message = 'No microphone device was detected. Please check your audio hardware.';
              break;
            case 'network':
              message = 'Network error during speech recognition. Check your internet connection.';
              break;
            case 'aborted':
              message = '';
              break;
            default:
              message = `Speech recognition error: ${event.error}`;
          }

          if (message) {
            setError(message);
            optionsRef.current.onError?.(message);
          }
          setIsListening(false);
          setInterimTranscript('');
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
          optionsRef.current.onEnd?.(fullTranscriptRef.current);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not activate microphone.';
        setError(msg);
        setIsListening(false);
      }
    },
    [language]
  );

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    language,
    setLanguage,
    startListening,
    stopListening,
    resetTranscript,
    clearError,
  };
}
