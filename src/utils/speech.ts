/**
 * High-Quality Native English Voice Engine
 * Uses server-side Gemini 3.1 Flash TTS as primary voice engine with caching,
 * and falls back to Web Speech API if offline or unavailable.
 */

import { VoiceSettings, VoiceAccent } from '../types';

export const cleanWord = (word: string): string =>
  word.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');

export const AVAILABLE_VOICES = [
  { id: 'Erinome', label: 'Erinome', desc: 'Trong trẻo, tự nhiên (Clear)' },
  { id: 'Achird', label: 'Achird', desc: 'Thân thiện, ấm áp (Friendly)' },
  { id: 'Sulafat', label: 'Sulafat', desc: 'Dịu dàng, truyền cảm (Warm)' },
  { id: 'Aoede', label: 'Aoede', desc: 'Thanh thoát, tươi mới (Breezy)' },
  { id: 'Kore', label: 'Kore', desc: 'Vững vàng, dõng dạc (Firm)' },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  accent: 'en-US',
  voice: 'Erinome',
  speed: 'normal',
};

const VOICE_SETTINGS_STORAGE_KEY = 'smart_reading_voice_settings';
const AUDIO_CACHE_KEY_PREFIX = 'sr_tts_cache_';
const MAX_LOCAL_STORAGE_CACHE = 80;

// In-memory audio cache: cacheKey -> base64 WAV data
const memoryAudioCache = new Map<string, string>();

// Keep track of currently playing audio to avoid overlapping sound
let currentActiveAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Load voice settings from localStorage
 */
export const loadVoiceSettings = (): VoiceSettings => {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      accent: parsed.accent === 'en-GB' ? 'en-GB' : 'en-US',
      voice: parsed.voice || 'Erinome',
      speed: parsed.speed === 'slow' ? 'slow' : 'normal',
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
};

/**
 * Save voice settings to localStorage
 */
export const saveVoiceSettings = (settings: VoiceSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save voice settings:', err);
  }
};

/**
 * Build unique cache key: word_accent_voice
 */
export const getAudioCacheKey = (
  text: string,
  accent: VoiceAccent,
  voice: string,
): string => {
  const clean = text.includes(' ') ? text.trim() : cleanWord(text);
  return `${clean.toLowerCase()}_${accent}_${voice}`;
};

/**
 * Get audio from cache (memory or localStorage)
 */
const getAudioFromCache = (cacheKey: string): string | null => {
  if (memoryAudioCache.has(cacheKey)) {
    return memoryAudioCache.get(cacheKey)!;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(AUDIO_CACHE_KEY_PREFIX + cacheKey);
      if (stored) {
        memoryAudioCache.set(cacheKey, stored);
        return stored;
      }
    } catch {
      // ignore
    }
  }
  return null;
};

/**
 * Save audio to cache (memory + localStorage with LRU eviction)
 */
const saveAudioToCache = (cacheKey: string, base64Wav: string): void => {
  memoryAudioCache.set(cacheKey, base64Wav);

  if (typeof window !== 'undefined') {
    try {
      // Track list of stored keys for eviction
      const indexKey = 'sr_tts_cache_keys_index';
      let keys: string[] = [];
      try {
        keys = JSON.parse(localStorage.getItem(indexKey) || '[]');
      } catch {
        keys = [];
      }

      // Add new key to front
      keys = [cacheKey, ...keys.filter((k) => k !== cacheKey)];

      // Evict oldest if exceeding limit
      while (keys.length > MAX_LOCAL_STORAGE_CACHE) {
        const oldestKey = keys.pop();
        if (oldestKey) {
          localStorage.removeItem(AUDIO_CACHE_KEY_PREFIX + oldestKey);
        }
      }

      localStorage.setItem(indexKey, JSON.stringify(keys));
      localStorage.setItem(AUDIO_CACHE_KEY_PREFIX + cacheKey, base64Wav);
    } catch {
      // localStorage quota exceeded or disabled, memory cache still holds it
    }
  }
};

/**
 * Browser Speech Synthesis fallback (Web Speech API)
 */
export const speakBrowserFallback = (
  text: string,
  rate = 0.9,
  accent: VoiceAccent = 'en-US',
): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Browser speech synthesis is not supported.');
    return;
  }

  const textToSpeak = text.includes(' ') ? text.trim() : cleanWord(text);
  if (!textToSpeak) return;

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = accent === 'en-GB' ? 'en-GB' : 'en-US';
    utterance.rate = rate;

    const voices = window.speechSynthesis.getVoices() || [];
    const targetLang = accent === 'en-GB' ? 'en-GB' : 'en-US';

    // Priority order for natural human native voices on Chrome, Edge, Mac, iOS, Android
    const priorityKeywords =
      accent === 'en-GB'
        ? ['google uk english female', 'google uk english male', 'daniel', 'serena', 'oliver', 'george', 'libby', 'ryan', 'en-gb']
        : ['google us english', 'samantha', 'jenny', 'guy', 'aria', 'natural', 'karen', 'ava', 'allison', 'en-us'];

    let chosenVoice: SpeechSynthesisVoice | undefined;
    for (const kw of priorityKeywords) {
      chosenVoice = voices.find(
        (v) =>
          (v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase() ||
            v.lang.toLowerCase().startsWith(accent === 'en-GB' ? 'en-gb' : 'en-us')) &&
          v.name.toLowerCase().includes(kw),
      );
      if (chosenVoice) break;
    }

    if (!chosenVoice) {
      chosenVoice =
        voices.find((v) => v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (err) {
    console.error('Browser speech synthesis fallback error:', err);
  }
};

/**
 * High-Quality Native English TTS with caching and fallback
 */
export const speakEnglishWithGemini = async (
  text: string,
  options?: {
    accent?: VoiceAccent;
    voice?: string;
    speed?: 'normal' | 'slow';
    onLoadingChange?: (loading: boolean) => void;
  },
): Promise<void> => {
  if (!text || !text.trim()) return;

  const currentSettings = loadVoiceSettings();
  const accent = options?.accent || currentSettings.accent;
  const voice = options?.voice || currentSettings.voice;
  const speed = options?.speed || currentSettings.speed;
  const rateMultiplier = speed === 'slow' ? 0.82 : 0.95;

  const textToSpeak = text.includes(' ') ? text.trim() : cleanWord(text);
  if (!textToSpeak) return;

  // Stop any previous playing audio
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentActiveAudio = null;
  }

  // Cancel any browser synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const cacheKey = getAudioCacheKey(textToSpeak, accent, voice);
  const cachedAudio = getAudioFromCache(cacheKey);

  if (cachedAudio) {
    // Instant playback from cache!
    const mimeType = cachedAudio.startsWith('UklGR') ? 'audio/wav' : 'audio/mpeg';
    try {
      const audio = new Audio(`data:${mimeType};base64,${cachedAudio}`);
      audio.playbackRate = rateMultiplier;
      currentActiveAudio = audio;
      await audio.play();
      return;
    } catch (playErr) {
      console.warn('Cache audio play error, re-fetching...', playErr);
    }
  }

  // Generate via Server TTS / Native Audio on server
  options?.onLoadingChange?.(true);

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSpeak,
        voice,
        accent,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS server responded with ${response.status}`);
    }

    const data = await response.json();
    if (!data.audioBase64) {
      throw new Error('No audio returned from TTS server');
    }

    // Save to cache for future instantaneous playback
    saveAudioToCache(cacheKey, data.audioBase64);

    options?.onLoadingChange?.(false);

    // Play native audio with proper mime type (MPEG mp3 or WAV)
    const mimeType = data.mimeType || (data.audioBase64.startsWith('UklGR') ? 'audio/wav' : 'audio/mpeg');
    const audio = new Audio(`data:${mimeType};base64,${data.audioBase64}`);
    audio.playbackRate = rateMultiplier;
    currentActiveAudio = audio;
    await audio.play();
  } catch (error) {
    console.warn('TTS API error, attempting direct dictionary audio playback:', error);
    options?.onLoadingChange?.(false);

    // Direct browser audio fallback to Google Dictionary / Cambridge pronunciation CDN
    const isSingleWord = !textToSpeak.includes(' ');
    if (isSingleWord) {
      try {
        const accentSuffix = accent === 'en-GB' ? 'gb' : 'us';
        const directAudioUrl = `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${textToSpeak.toLowerCase()}--_${accentSuffix}_1.mp3`;
        const audio = new Audio(directAudioUrl);
        audio.playbackRate = rateMultiplier;
        currentActiveAudio = audio;
        await audio.play();
        return;
      } catch (directErr) {
        console.warn('Direct dictionary audio playback failed:', directErr);
      }
    }

    // Graceful fallback to browser speech synthesis
    speakBrowserFallback(textToSpeak, rateMultiplier, accent);
  }
};

/**
 * Standard speakEnglish wrapper matching existing API
 */
export const speakEnglish = (
  text: string,
  rate = 0.9,
  onLoadingChange?: (loading: boolean) => void,
): void => {
  const settings = loadVoiceSettings();
  const speed = rate < 0.88 ? 'slow' : 'normal';

  speakEnglishWithGemini(text, {
    accent: settings.accent,
    voice: settings.voice,
    speed,
    onLoadingChange,
  }).catch((err) => {
    console.error('speakEnglish error:', err);
  });
};

/**
 * Helper to explicitly pronounce in a specific accent (US or UK)
 */
export const speakWordWithAccent = (
  text: string,
  accent: VoiceAccent,
  speed: 'normal' | 'slow' = 'normal',
  onLoadingChange?: (loading: boolean) => void,
): Promise<void> => {
  const settings = loadVoiceSettings();
  return speakEnglishWithGemini(text, {
    accent,
    voice: settings.voice,
    speed,
    onLoadingChange,
  });
};

export const speakWord = speakEnglish;

export const stopSpeech = (): void => {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentActiveAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
};

export const unlockAudio = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }
};
