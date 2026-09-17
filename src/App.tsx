import React, { useState, useEffect, useCallback } from 'react';
import { lookupWord } from './data/storyData';
import {
  SelectedWordInfo,
  WordStatus,
  AppMode,
  StudentTab,
  VoiceSettings,
  Story,
  ReadingAppearance,
} from './types';
import {
  loadUserProgress,
  saveKnownWords,
  saveLearningWords,
  saveSpeechRate,
  resetAllProgress,
  loadActiveStory,
  loadRequiredKeywordProgress,
  saveRequiredKeywordProgress,
  loadReadingAppearance,
  saveReadingAppearance,
  loadAllStories,
  saveAllStories,
  loadActiveStoryId,
  saveActiveStoryId,
  loadStoryKeywordProgress,
  saveStoryKeywordProgress,
} from './utils/storage';
import { Header } from './components/Header';
import { ReadingPage } from './components/ReadingPage';
import { VocabularyPage } from './components/VocabularyPage';
import { VocabularyPopup } from './components/VocabularyPopup';
import { TeacherEditor } from './components/TeacherEditor';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { AppearanceModal } from './components/AppearanceModal';
import { ReadingPracticeSection } from './components/ReadingPracticeSection';
import { StoryLibraryPage } from './components/StoryLibraryPage';
import { Check, BookmarkPlus, Sparkles, LayoutGrid } from 'lucide-react';
import { speakWord, loadVoiceSettings, stopSpeech } from './utils/speech';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('student');
  const [studentTab, setStudentTab] = useState<StudentTab>('library');
  const [stories, setStories] = useState<Story[]>(() => loadAllStories());
  const [activeStoryId, setActiveStoryId] = useState<string>(() => loadActiveStoryId());
  const [story, setStory] = useState<Story>(() => loadActiveStory());
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [appearance, setAppearance] = useState<ReadingAppearance>(() => loadReadingAppearance());
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);

  const [knownWords, setKnownWords] = useState<string[]>([]);
  const [learningWords, setLearningWords] = useState<string[]>([]);
  const [requiredKeywordProgress, setRequiredKeywordProgress] = useState<
    Record<string, 'learned' | 'pending'>
  >(() => loadStoryKeywordProgress(loadActiveStoryId()));

  // Map of storyId -> keyword progress
  const [storyProgressMap, setStoryProgressMap] = useState<
    Record<string, Record<string, 'learned' | 'pending'>>
  >(() => {
    const map: Record<string, Record<string, 'learned' | 'pending'>> = {};
    const all = loadAllStories();
    all.forEach((s) => {
      map[s.id] = loadStoryKeywordProgress(s.id);
    });
    return map;
  });

  const [speechRate, setSpeechRate] = useState<number>(0.9);
  const [selectedWord, setSelectedWord] = useState<SelectedWordInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'known' | 'learning' | 'info' } | null>(null);

  // Initialize data from localStorage on mount
  useEffect(() => {
    const saved = loadUserProgress();
    setKnownWords(saved.knownWords);
    setLearningWords(saved.learningWords);
    setSpeechRate(saved.speechRate);
  }, []);

  const handleUpdateAppearance = (newApp: ReadingAppearance) => {
    setAppearance(newApp);
    saveReadingAppearance(newApp);
  };

  const showToast = useCallback((message: string, type: 'known' | 'learning' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 2500);
  }, []);

  // Mark word as "ĐÃ BIẾT"
  const handleMarkKnown = useCallback(
    (wordToMark: string) => {
      const lower = wordToMark.toLowerCase();

      setKnownWords((prev) => {
        const next = Array.from(new Set([...prev, lower]));
        saveKnownWords(next);
        return next;
      });

      // Remove from learning if exists
      setLearningWords((prev) => {
        const next = prev.filter((w) => w !== lower);
        saveLearningWords(next);
        return next;
      });

      setSelectedWord(null);
      showToast(`Đã lưu "${wordToMark}" vào danh sách ĐÃ BIẾT`, 'known');
    },
    [showToast],
  );

  // Mark word as "HỌC"
  const handleMarkLearning = useCallback(
    (wordToMark: string) => {
      const lower = wordToMark.toLowerCase();
      const reqId = selectedWord?.requiredKeywordId || lower;

      setLearningWords((prev) => {
        const next = Array.from(new Set([...prev, lower]));
        saveLearningWords(next);
        return next;
      });

      // Mark required keyword as learned and persist to localStorage
      setRequiredKeywordProgress((prev) => {
        const next = { ...prev, [reqId]: 'learned' as const, [lower]: 'learned' as const };
        saveStoryKeywordProgress(story.id, next);
        setStoryProgressMap((pmap) => ({
          ...pmap,
          [story.id]: next,
        }));
        return next;
      });

      // Remove from known if exists
      setKnownWords((prev) => {
        const next = prev.filter((w) => w !== lower);
        saveKnownWords(next);
        return next;
      });

      setSelectedWord(null);
      showToast(`Đã thêm "${wordToMark}" vào mục "Từ của tôi" & đánh dấu đã học`, 'learning');
    },
    [selectedWord, story.id, showToast],
  );

  // In VocabularyPage: "ĐÃ NHỚ" moves from learning to known
  const handleMarkAsRemembered = useCallback(
    (wordToMark: string) => {
      const lower = wordToMark.toLowerCase();

      setLearningWords((prev) => {
        const next = prev.filter((w) => w !== lower);
        saveLearningWords(next);
        return next;
      });

      setKnownWords((prev) => {
        const next = Array.from(new Set([...prev, lower]));
        saveKnownWords(next);
        return next;
      });

      showToast(`Tuyệt vời! "${wordToMark}" đã chuyển sang ĐÃ NHỚ`, 'known');
    },
    [showToast],
  );

  // Reset all progress
  const handleResetProgress = useCallback(() => {
    resetAllProgress();
    saveStoryKeywordProgress(story.id, {});
    setKnownWords([]);
    setLearningWords([]);
    setRequiredKeywordProgress({});
    setStoryProgressMap((prev) => ({
      ...prev,
      [story.id]: {},
    }));
    setSelectedWord(null);
    showToast('Đã đặt lại toàn bộ tiến độ học từ', 'info');
  }, [story.id, showToast]);

  // Switch to a chosen story from the library or dropdown
  const handleSelectStory = useCallback(
    (storyId: string, directTab?: StudentTab) => {
      const target = stories.find((s) => s.id === storyId);
      if (!target) return;

      stopSpeech();
      setActiveStoryId(storyId);
      saveActiveStoryId(storyId);
      setStory(target);

      // Load progress specifically for this story
      const prog = loadStoryKeywordProgress(storyId);
      setRequiredKeywordProgress(prog);

      if (directTab) {
        setStudentTab(directTab);
      } else {
        setStudentTab('reading');
      }

      setSelectedWord(null);
      showToast(`Đã mở bài đọc: "${target.title}"`, 'info');
    },
    [stories, showToast],
  );

  const handleCreateNewStory = useCallback(() => {
    setAppMode('teacher');
    showToast('Chuyển sang chế độ Soạn bài để thêm bài đọc mới!', 'info');
  }, [showToast]);

  const handleUpdateStory = useCallback((updated: Story) => {
    setStory(updated);
    setStories((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      let next: Story[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = updated;
      } else {
        next = [updated, ...prev];
      }
      saveAllStories(next);
      return next;
    });
  }, []);

  // Click on keyword shelf directly
  const handleSelectKeywordDirect = useCallback(
    (kw: string) => {
      const detail = lookupWord(kw, story);
      speakWord(kw, speechRate);

      const lower = kw.toLowerCase();
      const allSpans = Array.from(document.querySelectorAll('span[role="button"], strong[role="button"]'));
      const matchingSpan = allSpans.find((el) => el.textContent?.trim().toLowerCase() === lower);

      let rect = {
        top: window.innerHeight / 3,
        left: window.innerWidth / 2 - 160,
        bottom: window.innerHeight / 3 + 40,
        right: window.innerWidth / 2 + 160,
        width: 100,
        height: 30,
      };

      if (matchingSpan) {
        const domRect = matchingSpan.getBoundingClientRect();
        rect = {
          top: domRect.top,
          left: domRect.left,
          bottom: domRect.bottom,
          right: domRect.right,
          width: domRect.width,
          height: domRect.height,
        };
      }

      const isReq =
        story.requiredKeywords?.some((rk) => rk.id.toLowerCase() === lower) ||
        detail.isKeyword;

      setSelectedWord({
        word: kw,
        rawText: kw,
        rect,
        detail,
        isRequiredKeyword: Boolean(isReq),
        requiredKeywordId: lower,
      });
    },
    [speechRate, story],
  );

  // Derive status of currently selected word
  let selectedWordStatus: WordStatus = 'unmarked';
  if (selectedWord) {
    const lower = selectedWord.word.toLowerCase();
    if (learningWords.includes(lower)) {
      selectedWordStatus = 'learning';
    } else if (knownWords.includes(lower)) {
      selectedWordStatus = 'known';
    }
  }

  // App page theme background classes
  const pageBgClass =
    appearance.theme === 'dark'
      ? 'bg-[#0B0F19] text-slate-100'
      : appearance.theme === 'sepia'
        ? 'bg-[#F7F2E7] text-stone-900'
        : 'bg-[#F4F6FB] text-slate-900';

  return (
    <div className={`min-h-screen ${pageBgClass} flex flex-col transition-colors duration-200 selection:bg-indigo-200 selection:text-indigo-950`}>
      {/* App Navigation Header */}
      <Header
        appMode={appMode}
        onModeChange={(mode) => {
          setAppMode(mode);
          setSelectedWord(null);
        }}
        studentTab={studentTab}
        onStudentTabChange={(tab) => {
          setStudentTab(tab);
          setSelectedWord(null);
        }}
        learningCount={learningWords.length}
        knownCount={knownWords.length}
        voiceSettings={voiceSettings}
        appearance={appearance}
        onOpenVoiceSettings={() => setIsVoiceModalOpen(true)}
        onOpenAppearance={() => setIsAppearanceModalOpen(true)}
        onResetProgress={handleResetProgress}
      />

      {/* Main Content Area */}
      <div className="flex-1 py-4 sm:py-6">
        {appMode === 'teacher' ? (
          <div className="px-4 sm:px-6">
            <TeacherEditor
              story={story}
              onUpdateStory={handleUpdateStory}
              knownWords={knownWords}
              learningWords={learningWords}
              speechRate={speechRate}
            />
          </div>
        ) : studentTab === 'library' ? (
          <StoryLibraryPage
            stories={stories}
            activeStoryId={activeStoryId}
            appearance={appearance}
            voiceSettings={voiceSettings}
            storyProgressMap={storyProgressMap}
            onSelectStory={handleSelectStory}
            onCreateNewStory={handleCreateNewStory}
          />
        ) : studentTab === 'reading' ? (
          <ReadingPage
            story={story}
            allStories={stories}
            knownWords={knownWords}
            learningWords={learningWords}
            requiredKeywordProgress={requiredKeywordProgress}
            selectedWord={selectedWord}
            speechRate={speechRate}
            appearance={appearance}
            onSelectWord={(info) => setSelectedWord(info)}
            onSelectKeywordDirect={handleSelectKeywordDirect}
            onSwitchToPractice={() => setStudentTab('practice')}
            onSwitchToVocabulary={() => setStudentTab('vocabulary')}
            onBackToLibrary={() => setStudentTab('library')}
            onSelectStory={(id) => handleSelectStory(id, 'reading')}
          />
        ) : studentTab === 'practice' ? (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-xs">
              <button
                type="button"
                onClick={() => setStudentTab('library')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer active:scale-95"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>← Mở các ô cửa sổ bài đọc</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
                  Đang luyện bài:
                </span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  {story.title}
                </span>
              </div>
            </div>
            <ReadingPracticeSection
              story={story}
              speechRate={speechRate}
              onSelectKeywordDirect={handleSelectKeywordDirect}
            />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-xs">
              <button
                type="button"
                onClick={() => setStudentTab('library')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer active:scale-95"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>← Mở các ô cửa sổ bài đọc</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
                  Từ vựng bài:
                </span>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  {story.title}
                </span>
              </div>
            </div>
            <VocabularyPage
              story={story}
              learningWords={learningWords}
              knownWords={knownWords}
              speechRate={speechRate}
              appearance={appearance}
              onMarkAsRemembered={handleMarkAsRemembered}
              onSwitchToReading={() => setStudentTab('reading')}
            />
          </div>
        )}
      </div>

      {/* Floating Vocabulary Popup when a word is selected */}
      {selectedWord && (
        <VocabularyPopup
          selectedWord={selectedWord}
          wordStatus={selectedWordStatus}
          speechRate={speechRate}
          appearance={appearance}
          isRequiredKeyword={Boolean(selectedWord.isRequiredKeyword)}
          isRequiredLearned={
            requiredKeywordProgress[
              selectedWord.requiredKeywordId || selectedWord.word.toLowerCase()
            ] === 'learned'
          }
          onMarkKnown={handleMarkKnown}
          onMarkLearning={handleMarkLearning}
          onClose={() => setSelectedWord(null)}
        />
      )}

      {/* Appearance Modal (Themes, Font sizes, Font families, Line spacings) */}
      <AppearanceModal
        isOpen={isAppearanceModalOpen}
        onClose={() => setIsAppearanceModalOpen(false)}
        appearance={appearance}
        onChange={handleUpdateAppearance}
      />

      {/* Voice Settings Modal (Gemini Native English TTS) */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        settings={voiceSettings}
        onUpdateSettings={(newSettings) => {
          setVoiceSettings(newSettings);
          showToast(
            `Đã chuyển giọng đọc: ${newSettings.voice} (${newSettings.accent === 'en-GB' ? 'UK' : 'US'})`,
            'info',
          );
        }}
      />

      {/* Feedback Toast */}
      {toast && (
        <div
          id="app-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl border text-sm font-semibold flex items-center gap-2 backdrop-blur-md ${
              toast.type === 'known'
                ? 'bg-emerald-800/95 text-white border-emerald-700'
                : toast.type === 'learning'
                  ? 'bg-slate-900/95 text-amber-300 border-slate-800'
                  : 'bg-slate-800/95 text-white border-slate-700'
            }`}
          >
            {toast.type === 'known' ? (
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
            ) : toast.type === 'learning' ? (
              <BookmarkPlus className="w-4 h-4 text-amber-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
