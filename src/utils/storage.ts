import { UserProgress, Story, StoryParagraph, StoryKeyword, ReadingAttemptRecord, ReadingAppearance } from '../types';
import { SAMPLE_STORY, DEFAULT_STORIES } from '../data/storyData';

const STORAGE_KEYS = {
  KNOWN_WORDS: 'smart_reading_known_words_v1',
  LEARNING_WORDS: 'smart_reading_learning_words_v1',
  READ_PARAGRAPHS: 'smart_reading_read_paragraphs_v1',
  SPEECH_RATE: 'smart_reading_speech_rate_v1',
  ACTIVE_STORY: 'smart_reading_active_story_v2',
  STORIES_COLLECTION: 'smart_reading_stories_collection_v2',
  ACTIVE_STORY_ID: 'smart_reading_active_story_id_v2',
  REQUIRED_PROGRESS: 'smart_reading_required_progress_v2',
  STORY_PROGRESS_PREFIX: 'smart_reading_keyword_progress_',
  READING_ATTEMPTS: 'smart_reading_attempts_v1',
  APPEARANCE: 'smart_reading_appearance_v1',
};

export const DEFAULT_APPEARANCE: ReadingAppearance = {
  theme: 'paper',
  fontSize: 'md',
  fontFamily: 'serif',
  lineSpacing: 'normal',
};

export function loadReadingAppearance(): ReadingAppearance {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPEARANCE);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw);
    return {
      theme: ['paper', 'sepia', 'dark'].includes(parsed.theme) ? parsed.theme : 'paper',
      fontSize: ['sm', 'md', 'lg', 'xl'].includes(parsed.fontSize) ? parsed.fontSize : 'md',
      fontFamily: ['serif', 'sans'].includes(parsed.fontFamily) ? parsed.fontFamily : 'serif',
      lineSpacing: ['compact', 'normal', 'relaxed'].includes(parsed.lineSpacing) ? parsed.lineSpacing : 'normal',
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveReadingAppearance(appearance: ReadingAppearance): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.APPEARANCE, JSON.stringify(appearance));
  } catch (err) {
    console.warn('Failed to save reading appearance:', err);
  }
}

export function loadRequiredKeywordProgress(): Record<string, 'learned' | 'pending'> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REQUIRED_PROGRESS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.error('Failed to load required keyword progress:', e);
    return {};
  }
}

export function saveRequiredKeywordProgress(
  progress: Record<string, 'learned' | 'pending'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.REQUIRED_PROGRESS, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save required keyword progress:', e);
  }
}

export function loadUserProgress(): UserProgress {
  if (typeof window === 'undefined') {
    return {
      knownWords: [],
      learningWords: [],
      readParagraphs: [],
      speechRate: 0.9,
    };
  }

  try {
    const knownWordsRaw = localStorage.getItem(STORAGE_KEYS.KNOWN_WORDS);
    const learningWordsRaw = localStorage.getItem(STORAGE_KEYS.LEARNING_WORDS);
    const readParagraphsRaw = localStorage.getItem(STORAGE_KEYS.READ_PARAGRAPHS);
    const speechRateRaw = localStorage.getItem(STORAGE_KEYS.SPEECH_RATE);

    const knownWords: string[] = knownWordsRaw ? JSON.parse(knownWordsRaw) : [];
    const learningWords: string[] = learningWordsRaw ? JSON.parse(learningWordsRaw) : [];
    const readParagraphs: string[] = readParagraphsRaw ? JSON.parse(readParagraphsRaw) : [];
    const speechRate = speechRateRaw ? parseFloat(speechRateRaw) : 0.9;

    return {
      knownWords: Array.isArray(knownWords) ? knownWords : [],
      learningWords: Array.isArray(learningWords) ? learningWords : [],
      readParagraphs: Array.isArray(readParagraphs) ? readParagraphs : [],
      speechRate: isNaN(speechRate) ? 0.9 : speechRate,
    };
  } catch (e) {
    console.error('Failed to load user progress from localStorage:', e);
    return {
      knownWords: [],
      learningWords: [],
      readParagraphs: [],
      speechRate: 0.9,
    };
  }
}

export function saveKnownWords(words: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.KNOWN_WORDS, JSON.stringify(words));
  } catch (e) {
    console.error('Failed to save known words:', e);
  }
}

export function saveLearningWords(words: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LEARNING_WORDS, JSON.stringify(words));
  } catch (e) {
    console.error('Failed to save learning words:', e);
  }
}

export function saveReadParagraphs(paragraphs: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.READ_PARAGRAPHS, JSON.stringify(paragraphs));
  } catch (e) {
    console.error('Failed to save read paragraphs:', e);
  }
}

export function saveSpeechRate(rate: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SPEECH_RATE, rate.toString());
  } catch (e) {
    console.error('Failed to save speech rate:', e);
  }
}

export function resetAllProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.KNOWN_WORDS);
    localStorage.removeItem(STORAGE_KEYS.LEARNING_WORDS);
    localStorage.removeItem(STORAGE_KEYS.READ_PARAGRAPHS);
    localStorage.removeItem(STORAGE_KEYS.SPEECH_RATE);
  } catch (e) {
    console.error('Failed to reset storage:', e);
  }
}

/**
 * Splits multiline raw text into clean StoryParagraphs preserving punctuation and sentences
 */
export function parseStoryContentToParagraphs(rawContent: string): StoryParagraph[] {
  if (!rawContent || !rawContent.trim()) {
    return [];
  }

  return rawContent
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((text, idx) => ({
      id: `p${idx + 1}`,
      text,
    }));
}

/**
 * Accurately calculate English word count
 */
export function calculateStoryWordCount(paragraphs: StoryParagraph[]): number {
  return paragraphs.reduce((sum, p) => {
    const tokens = p.text.match(/[a-zA-Z0-9]+(?:['’][a-zA-Z0-9]+)?/g);
    return sum + (tokens ? tokens.length : 0);
  }, 0);
}

/**
 * Load all stories from localStorage or initialize with DEFAULT_STORIES
 */
export function loadAllStories(): Story[] {
  if (typeof window === 'undefined') {
    return DEFAULT_STORIES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORIES_COLLECTION);
    if (!raw) {
      // Initialize with default stories collection
      localStorage.setItem(STORAGE_KEYS.STORIES_COLLECTION, JSON.stringify(DEFAULT_STORIES));
      return DEFAULT_STORIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_STORIES;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load stories collection:', e);
    return DEFAULT_STORIES;
  }
}

/**
 * Save all stories to localStorage
 */
export function saveAllStories(stories: Story[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.STORIES_COLLECTION, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed to save stories collection:', e);
  }
}

/**
 * Load active story id
 */
export function loadActiveStoryId(): string {
  if (typeof window === 'undefined') return DEFAULT_STORIES[0].id;
  try {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_STORY_ID);
    if (id) return id;
  } catch (e) {
    console.error('Failed to load active story ID:', e);
  }
  return DEFAULT_STORIES[0].id;
}

/**
 * Save active story id
 */
export function saveActiveStoryId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_STORY_ID, id);
  } catch (e) {
    console.error('Failed to save active story ID:', e);
  }
}

/**
 * Load keyword progress specifically for a story
 */
export function loadStoryKeywordProgress(storyId: string): Record<string, 'learned' | 'pending'> {
  if (typeof window === 'undefined') return {};
  try {
    const key = `${STORAGE_KEYS.STORY_PROGRESS_PREFIX}${storyId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
    // Fallback to global progress if legacy
    return loadRequiredKeywordProgress();
  } catch (e) {
    console.error(`Failed to load keyword progress for story ${storyId}:`, e);
    return {};
  }
}

/**
 * Save keyword progress specifically for a story
 */
export function saveStoryKeywordProgress(
  storyId: string,
  progress: Record<string, 'learned' | 'pending'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_KEYS.STORY_PROGRESS_PREFIX}${storyId}`;
    localStorage.setItem(key, JSON.stringify(progress));
    saveRequiredKeywordProgress(progress);
  } catch (e) {
    console.error(`Failed to save keyword progress for story ${storyId}:`, e);
  }
}

/**
 * Load active story from localStorage or fallback to default sample story
 */
export function loadActiveStory(): Story {
  if (typeof window === 'undefined') {
    return DEFAULT_STORIES[0];
  }
  try {
    const allStories = loadAllStories();
    const activeId = loadActiveStoryId();
    const found = allStories.find((s) => s.id === activeId);
    if (found) return found;
    return allStories[0] || SAMPLE_STORY;
  } catch (e) {
    console.error('Failed to load active story:', e);
    return SAMPLE_STORY;
  }
}

/**
 * Save active story to localStorage and update in the collection
 */
export function saveActiveStory(story: Story): void {
  if (typeof window === 'undefined') return;
  try {
    const allStories = loadAllStories();
    const index = allStories.findIndex((s) => s.id === story.id);
    let updatedStories: Story[];
    if (index >= 0) {
      updatedStories = [...allStories];
      updatedStories[index] = story;
    } else {
      updatedStories = [story, ...allStories];
    }
    saveAllStories(updatedStories);
    saveActiveStoryId(story.id);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_STORY, JSON.stringify(story));
  } catch (e) {
    console.error('Failed to save active story:', e);
  }
}

/**
 * Restore default stories
 */
export function restoreDefaultStory(): Story {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEYS.STORIES_COLLECTION);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_STORY);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_STORY_ID);
    } catch {
      // ignore
    }
  }
  return DEFAULT_STORIES[0];
}

/**
 * Load student reading attempts history
 */
export function loadReadingAttempts(storyId?: string): ReadingAttemptRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READING_ATTEMPTS);
    if (!raw) return [];
    const list: ReadingAttemptRecord[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (storyId) {
      return list.filter((item) => item.storyId === storyId);
    }
    return list;
  } catch (err) {
    console.warn('Failed to load reading attempts:', err);
    return [];
  }
}

/**
 * Save new reading attempt (keeps up to 50 most recent attempts)
 */
export function saveReadingAttempt(attempt: ReadingAttemptRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadReadingAttempts();
    const updated = [attempt, ...all].slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.READING_ATTEMPTS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save reading attempt:', err);
  }
}

/**
 * Get student best total score for a given story
 */
export function getBestReadingScore(storyId: string): number | null {
  const attempts = loadReadingAttempts(storyId);
  if (attempts.length === 0) return null;
  return Math.max(...attempts.map((a) => a.totalScore));
}

/**
 * Get latest previous attempt for comparison
 */
export function getPreviousReadingAttempt(
  storyId: string,
  excludeId?: string,
): ReadingAttemptRecord | null {
  const attempts = loadReadingAttempts(storyId).filter(
    (a) => !excludeId || a.id !== excludeId,
  );
  return attempts.length > 0 ? attempts[0] : null;
}
