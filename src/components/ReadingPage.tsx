import React from 'react';
import { Story, SelectedWordInfo, ReadingAppearance } from '../types';
import { InteractiveText } from './InteractiveText';
import { ProgressBar } from './ProgressBar';
import {
  Volume2,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Lock,
  BookmarkCheck,
  Clock,
  Mic,
  ArrowRight,
  Flame,
  LayoutGrid,
} from 'lucide-react';
import { speakEnglish } from '../utils/speech';

interface ReadingPageProps {
  story: Story;
  allStories?: Story[];
  knownWords: string[];
  learningWords: string[];
  requiredKeywordProgress: Record<string, 'learned' | 'pending'>;
  selectedWord: SelectedWordInfo | null;
  speechRate: number;
  appearance: ReadingAppearance;
  onSelectWord: (info: SelectedWordInfo) => void;
  onSelectKeywordDirect: (keyword: string) => void;
  onSwitchToPractice?: () => void;
  onSwitchToVocabulary?: () => void;
  onBackToLibrary?: () => void;
  onSelectStory?: (storyId: string) => void;
}

export const ReadingPage: React.FC<ReadingPageProps> = ({
  story,
  allStories,
  knownWords,
  learningWords,
  requiredKeywordProgress,
  selectedWord,
  speechRate,
  appearance,
  onSelectWord,
  onSelectKeywordDirect,
  onSwitchToPractice,
  onSwitchToVocabulary,
  onBackToLibrary,
  onSelectStory,
}) => {
  const [isPlayingFullTitle, setIsPlayingFullTitle] = React.useState(false);
  const [isPlayingFullStory, setIsPlayingFullStory] = React.useState(false);
  const [isCompletedStory, setIsCompletedStory] = React.useState(false);

  const isDark = appearance.theme === 'dark';
  const isSepia = appearance.theme === 'sepia';

  const cardBgClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/60'
    : isSepia
      ? 'bg-[#FAF6EE] border-amber-900/15 text-stone-900 shadow-stone-900/5'
      : 'bg-white border-slate-200/90 text-slate-900 shadow-sm';

  const handleSpeakTitle = () => {
    setIsPlayingFullTitle(true);
    speakEnglish(story.title, speechRate);
    setTimeout(() => setIsPlayingFullTitle(false), 2000);
  };

  const handleSpeakFullStory = () => {
    if (isPlayingFullStory) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingFullStory(false);
      return;
    }

    const fullText = story.paragraphs.map((p) => p.text).join('\n\n');
    setIsPlayingFullStory(true);
    speakEnglish(fullText, speechRate);

    const words = fullText.split(/\s+/).length;
    const estSec = Math.max(8, Math.ceil((words / 130) * 60));
    setTimeout(() => setIsPlayingFullStory(false), estSec * 1000);
  };

  // Compute required keywords statistics
  const requiredKeywordsList = React.useMemo(() => {
    if (story.requiredKeywords && story.requiredKeywords.length > 0) {
      return story.requiredKeywords;
    }
    return (story.keywords || []).map((k) => ({
      id: k.toLowerCase(),
      text: k,
      required: true,
    }));
  }, [story.requiredKeywords, story.keywords]);

  const totalRequired = requiredKeywordsList.length;

  const learnedCount = React.useMemo(() => {
    return requiredKeywordsList.filter((kw) => {
      const id = kw.id.toLowerCase();
      return requiredKeywordProgress[id] === 'learned' || learningWords.includes(id);
    }).length;
  }, [requiredKeywordsList, requiredKeywordProgress, learningWords]);

  const pendingCount = Math.max(0, totalRequired - learnedCount);
  const allRequiredLearned = totalRequired === 0 || learnedCount >= totalRequired;
  const requireCompletion = story.requireAllKeywordsBeforeCompletion ?? true;
  const progressPercent = totalRequired > 0 ? Math.round((learnedCount / totalRequired) * 100) : 100;

  // Estimated reading time
  const readTimeMin = Math.max(1, Math.round(story.wordCount / 100));

  return (
    <main id="reading-page-main" className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-4">
      {/* Quick Navigation to Story Library & Quick Switcher */}
      {onBackToLibrary && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-xs">
          <button
            type="button"
            onClick={onBackToLibrary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer active:scale-95"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>← Mở các ô cửa sổ bài đọc</span>
          </button>

          {allStories && allStories.length > 1 && onSelectStory && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
                Đổi bài đọc:
              </span>
              <select
                value={story.id}
                onChange={(e) => onSelectStory(e.target.value)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {allStories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.level || 'Cơ bản'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* General Vocabulary Progress Bar */}
      <ProgressBar
        knownCount={knownWords.length}
        learningCount={learningWords.length}
        totalUniqueWordsEstimate={story.wordCount}
        appearance={appearance}
      />

      {/* Main Story Container Card */}
      <article className={`rounded-3xl border overflow-hidden transition-all duration-200 ${cardBgClass}`}>
        {/* Story Cover Image Banner */}
        <div className="relative w-full aspect-16/9 overflow-hidden bg-slate-900/10">
          <img
            src={story.coverImage}
            alt={story.title}
            className="w-full h-full object-cover object-center transform hover:scale-102 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

          {/* Floating colorful metadata badges */}
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
            <span className="bg-slate-900/85 backdrop-blur-md text-amber-300 text-xs font-black px-3.5 py-1.5 rounded-full shadow-md border border-white/10 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{story.level || 'A2 - B1'}</span>
            </span>
            <span className="bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>~{readTimeMin} phút đọc</span>
            </span>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 backdrop-blur-md text-white text-xs font-black px-3.5 py-1.5 rounded-full shadow-md border border-white/20">
              {story.wordCount} từ vựng
            </span>
          </div>

          {/* Bottom cover tip */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
            <span className="bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold border border-white/15">
              ✨ Chạm vào từ bất kỳ để nghe phát âm & tra nghĩa tiếng Việt tức thì
            </span>
          </div>
        </div>

        {/* Story Title & Audio Actions */}
        <div
          className={`p-6 sm:p-8 sm:pb-6 border-b ${
            isDark ? 'border-slate-800' : isSepia ? 'border-amber-900/15' : 'border-slate-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <h2
                className={`text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight mb-2 leading-tight ${
                  appearance.fontFamily === 'sans' ? 'font-sans' : 'font-serif'
                }`}
              >
                {story.title}
              </h2>
              {story.subtitle && (
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">
                  {story.subtitle}
                </p>
              )}
            </div>

            {/* Quick Action Audio Player buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                id="btn-speak-story-title"
                type="button"
                onClick={handleSpeakTitle}
                title="Nghe đọc tiêu đề"
                className={`p-2.5 rounded-2xl transition shadow-2xs flex items-center justify-center cursor-pointer active:scale-95 ${
                  isPlayingFullTitle
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40 scale-105'
                    : isDark
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </button>

              <button
                id="btn-speak-full-story"
                type="button"
                onClick={handleSpeakFullStory}
                title="Nghe đọc toàn bộ câu chuyện với giọng bản xứ"
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95 ${
                  isPlayingFullStory
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white ring-4 ring-indigo-400/30'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/20'
                }`}
              >
                <Volume2 className="w-4 h-4 text-amber-300" />
                <span>{isPlayingFullStory ? 'Đang đọc...' : 'Nghe toàn bài'}</span>
              </button>
            </div>
          </div>

          {/* REQUIRED KEYWORDS PROGRESS CARD - VIBRANT EYE-CATCHING LOOK */}
          {totalRequired > 0 && (
            <div
              id="required-keywords-tracker"
              className={`mt-6 p-4 sm:p-5 rounded-3xl border transition-all shadow-xs ${
                isDark
                  ? 'bg-gradient-to-br from-amber-950/40 to-slate-900 border-amber-500/30'
                  : isSepia
                    ? 'bg-gradient-to-br from-amber-100/80 to-orange-50/80 border-amber-300'
                    : 'bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-50/40 border-amber-200/90'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <span>Từ khóa trọng tâm bài đọc:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">
                        {learnedCount}/{totalRequired} đã học
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                      {allRequiredLearned
                        ? '🎉 Chúc mừng! Bạn đã hoàn thành tất cả từ khóa trọng tâm của bài đọc!'
                        : `Còn ${pendingCount} từ in đậm cần chạm vào và bấm "Lưu học từ".`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-black font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-3 py-1 rounded-xl border border-amber-300/80 dark:border-amber-700 shadow-2xs">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress bar track */}
              <div className="w-full h-2.5 rounded-full bg-amber-200/70 dark:bg-slate-800 overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-500 rounded-full shadow-xs ${
                    allRequiredLearned
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Keyword Quick Chips */}
              <div className="mt-3.5 flex items-center gap-2 flex-wrap pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
                {requiredKeywordsList.map((kw) => {
                  const id = kw.id.toLowerCase();
                  const isLearned =
                    requiredKeywordProgress[id] === 'learned' || learningWords.includes(id);

                  return (
                    <button
                      key={`req-chip-${id}`}
                      type="button"
                      onClick={() => onSelectKeywordDirect(kw.text)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${
                        isLearned
                          ? 'bg-emerald-500 text-white border border-emerald-400 shadow-emerald-500/20'
                          : 'bg-white dark:bg-slate-800 text-amber-950 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-600 hover:border-amber-500 hover:bg-amber-50/80'
                      }`}
                      title={isLearned ? 'Đã học (Bấm để tra & nghe lại)' : 'Chưa học (Bấm để tra & học)'}
                    >
                      <span>{kw.text}</span>
                      {isLearned ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* English Story Body */}
        <div className="p-6 sm:p-10 pt-6">
          <div
            className={`rounded-2xl p-4 mb-7 text-xs sm:text-sm flex items-start gap-3 border shadow-2xs ${
              isDark
                ? 'bg-indigo-950/30 border-indigo-800/50 text-indigo-200'
                : isSepia
                  ? 'bg-amber-100/70 border-amber-200 text-stone-800'
                  : 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Mẹo đọc thông minh:</strong> Chạm vào <strong>từ in đậm màu hổ phách</strong> để xem nghĩa ngữ cảnh và lưu học từ. Chạm vào <strong>bất kỳ từ tiếng Anh nào</strong> để nghe phát âm bản xứ tức thì.
            </p>
          </div>

          {/* Interactive Paragraphs */}
          <div className="space-y-3">
            {story.paragraphs.map((p) => (
              <InteractiveText
                key={p.id}
                paragraphId={p.id}
                text={p.text}
                html={p.html}
                knownWords={knownWords}
                learningWords={learningWords}
                requiredKeywordProgress={requiredKeywordProgress}
                selectedWord={selectedWord}
                speechRate={speechRate}
                story={story}
                appearance={appearance}
                onSelectWord={onSelectWord}
              />
            ))}
          </div>

          {/* Story Completion & Next Actions Section */}
          <div className="mt-10 pt-8 border-t border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            {requireCompletion && !allRequiredLearned ? (
              <div
                className={`rounded-3xl border p-5 sm:p-6 max-w-md w-full mb-4 text-center shadow-sm ${
                  isDark
                    ? 'bg-slate-800/60 border-slate-700'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs uppercase tracking-wider mb-1.5">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Hoàn thành các từ khóa bài đọc</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Bạn còn <strong>{pendingCount} từ khóa in đậm</strong> cần chạm vào và bấm &ldquo;Lưu học từ&rdquo;.
                </p>
              </div>
            ) : isCompletedStory ? (
              <div
                className={`rounded-3xl border p-6 sm:p-8 max-w-lg w-full mb-4 text-center animate-in zoom-in-95 shadow-md ${
                  isDark
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-slate-100'
                    : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 text-slate-900'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/25">
                  <BookmarkCheck className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h4 className="text-lg font-black mb-1">
                  Tuyệt vời! Bạn đã hoàn thành bài đọc!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                  Tất cả từ khóa đã được lưu vào sổ từ vựng. Bây giờ bạn có thể thử sức đọc to và chấm điểm phát âm bằng AI!
                </p>

                {/* Quick links to AI Practice and Vocab */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {onSwitchToPractice && (
                    <button
                      type="button"
                      onClick={onSwitchToPractice}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 cursor-pointer transition active:scale-95"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Luyện đọc phát âm với AI</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onSwitchToVocabulary && (
                    <button
                      type="button"
                      onClick={onSwitchToVocabulary}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 shadow-xs"
                    >
                      <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                      <span>Xem Sổ từ của tôi</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                id="btn-complete-reading"
                onClick={() => setIsCompletedStory(true)}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-md shadow-emerald-600/25 hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>Hoàn thành bài đọc</span>
              </button>
            )}

            <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 font-medium">
              — Kết thúc câu chuyện &bull; Luyện tập mỗi ngày để đọc trôi chảy hơn —
            </div>
          </div>
        </div>
      </article>
    </main>
  );
};
