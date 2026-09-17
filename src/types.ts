export interface WordDetail {
  word: string; // Base or inflected word (e.g. "tried")
  baseWord?: string; // Lemma (e.g. "try")
  ipa: string; // Phonetic transcription, e.g. "/traɪd/"
  partOfSpeech?: string; // "verb", "noun", "adjective", "adverb", etc.
  vietnameseMeaning: string; // Vietnamese definition
  exampleSentence?: string; // Example in English
  exampleTranslation?: string; // Translation in Vietnamese
  isKeyword?: boolean; // Highlighted by default for teacher recommendation
}

export interface StoryKeyword {
  word: string;
  ipa: string;
  meaningVi: string;
  partOfSpeech?: string;
  example?: string;
  exampleVi?: string;
}

export interface RequiredKeyword {
  id: string; // e.g. "responsibility"
  text: string; // e.g. "responsibility"
  required: boolean;
  meaningVi?: string;
  meaningSource?: 'ai' | 'teacher' | 'dictionary';
  teacherEdited?: boolean;
  ipa?: string;
  example?: string;
  exampleVi?: string;
  partOfSpeech?: string;
  contextSentence?: string;
}

export interface StoryParagraph {
  id: string;
  text: string;
  html?: string; // Rich HTML for paragraph preserving <strong> and <em>
}

export interface Story {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  level?: string; // "THCS / THPT (A2 - B1)"
  wordCount: number;
  coverImage?: string;
  content?: string; // Plain text fallback
  contentHtml?: string; // Rich HTML with <p>, <strong>, <em>, <br>
  paragraphs: StoryParagraph[];
  keywords: string[];
  keywordDetails?: Record<string, StoryKeyword>;
  requiredKeywords?: RequiredKeyword[];
  requireAllKeywordsBeforeCompletion?: boolean; // Default true
  speakingQuestions?: SpeakingQuestion[];
}

export type PracticeMode = 'read-aloud' | 'speaking';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface SpeakingQuestion {
  id: string;
  question: string;
  questionVi?: string;
  hints?: string[];
  suggestedKeywords?: string[];
  starterPhrase?: string;
  modelAnswer?: string;
}

export interface CEFRRubricCriterion {
  id: string;
  name: string; // e.g. "Độ dễ hiểu & Phát âm"
  score: number;
  maxScore: number;
  level: CEFRLevel;
  feedbackVi: string;
}

export interface SelectedWordInfo {
  word: string; // Cleaned word or phrase
  rawText: string; // Word or phrase as it appears
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  detail: WordDetail;
  isRequiredKeyword?: boolean;
  requiredKeywordId?: string;
}

export type WordStatus = 'learning' | 'known' | 'unmarked';

export type ReadingTheme = 'paper' | 'sepia' | 'dark';
export type ReadingFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type ReadingFontFamily = 'serif' | 'sans';
export type ReadingLineSpacing = 'compact' | 'normal' | 'relaxed';

export interface ReadingAppearance {
  theme: ReadingTheme;
  fontSize: ReadingFontSize;
  fontFamily: ReadingFontFamily;
  lineSpacing: ReadingLineSpacing;
}

export type StudentTab = 'library' | 'reading' | 'practice' | 'vocabulary';

export type VoiceAccent = 'en-US' | 'en-GB';
export type VoiceName = 'Erinome' | 'Achird' | 'Sulafat' | 'Aoede' | 'Kore';

export interface VoiceSettings {
  accent: VoiceAccent;
  voice: string;
  speed: 'normal' | 'slow';
}

export interface UserProgress {
  knownWords: string[]; // List of words marked "ĐÃ BIẾT"
  learningWords: string[]; // List of words marked "HỌC"
  readParagraphs: string[]; // Paragraph IDs read or scrolled through
  speechRate: number; // e.g. 0.85 or 1.0
  voiceSettings?: VoiceSettings;
}

export type AppMode = 'student' | 'teacher';

export interface RequiredKeywordAssessment {
  word: string;
  status: 'good' | 'practice' | 'unclear';
  feedbackVi: string;
}

export interface WordToPractice {
  word: string;
  reasonVi: string;
  referenceSentence?: string;
  status?: 'pending' | 'improved' | 'retry';
}

export interface AssessmentScores {
  pronunciation: number; // Max 40
  fluency: number; // Max 25
  intonation: number; // Max 20
  completeness: number; // Max 15
  total: number; // Max 100
}

export interface WordHighlight {
  word: string;
  status: 'correct' | 'practice' | 'omitted';
}

export interface ReadingAssessmentResult {
  isValidAudio: boolean;
  invalidReasonVi?: string;
  transcript?: string;
  mode?: PracticeMode;
  cefrLevel?: CEFRLevel;
  cefrLevelTitle?: string;
  cefrLevelDescriptionVi?: string;
  intelligibilityScore?: number; // 0 - 100
  intelligibilityNoteVi?: string;
  totalScore?: number;
  criteria?: CEFRRubricCriterion[];
  scores?: AssessmentScores;
  overallFeedbackVi?: string;
  strengthsVi?: string[];
  improvementsVi?: string[];
  requiredKeywordResults?: RequiredKeywordAssessment[];
  wordsToPractice?: WordToPractice[];
  wordHighlights?: WordHighlight[];
  // For speaking mode:
  questionAnswered?: string;
  grammarFeedbackVi?: string;
  suggestedBetterPhrasing?: string;
  suggestedVocabulary?: string[];
}

export interface ReadingAttemptRecord {
  id: string;
  storyId: string;
  timestamp: string; // ISO string
  mode?: PracticeMode;
  cefrLevel?: CEFRLevel;
  cefrLevelTitle?: string;
  intelligibilityScore?: number;
  totalScore: number;
  pronunciationScore?: number;
  fluencyScore?: number;
  intonationScore?: number;
  completenessScore?: number;
  criteria?: CEFRRubricCriterion[];
  overallFeedbackVi?: string;
  transcript?: string;
  questionText?: string;
  wordsToPractice?: WordToPractice[];
  requiredKeywordResults?: RequiredKeywordAssessment[];
  strengthsVi?: string[];
  improvementsVi?: string[];
  suggestedBetterPhrasing?: string;
}
