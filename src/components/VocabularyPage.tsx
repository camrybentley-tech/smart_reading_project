import React, { useState } from 'react';
import {
  Volume2,
  CheckCheck,
  Search,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Layers,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  X,
  Award,
} from 'lucide-react';
import { lookupWord } from '../data/storyData';
import { speakEnglish } from '../utils/speech';
import { Story, ReadingAppearance } from '../types';

interface VocabularyPageProps {
  learningWords: string[];
  knownWords: string[];
  speechRate: number;
  story?: Story;
  appearance?: ReadingAppearance;
  onMarkAsRemembered: (word: string) => void;
  onSwitchToReading: () => void;
  onRemoveWord?: (word: string) => void;
}

export const VocabularyPage: React.FC<VocabularyPageProps> = ({
  learningWords,
  knownWords,
  speechRate,
  story,
  appearance,
  onMarkAsRemembered,
  onSwitchToReading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'learning' | 'known'>('learning');
  const [viewMode, setViewMode] = useState<'list' | 'flashcard'>('list');
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  // Flashcard states
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const isDark = appearance?.theme === 'dark';
  const isSepia = appearance?.theme === 'sepia';

  const cardBgClass = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/50'
    : isSepia
      ? 'bg-[#FAF6EE] border-amber-900/15 text-stone-900 shadow-stone-900/5'
      : 'bg-white border-slate-200/90 text-slate-900 shadow-sm';

  const handleSpeak = (word: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlayingWord(word);
    speakEnglish(word, speechRate);
    setTimeout(() => setPlayingWord(null), 850);
  };

  const currentList = activeSubTab === 'learning' ? learningWords : knownWords;

  const filteredWords = currentList.filter((w) =>
    w.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  const totalWords = learningWords.length + knownWords.length;
  const masteryRate = totalWords > 0 ? Math.round((knownWords.length / totalWords) * 100) : 0;

  // Flashcard current item
  const currentFlashcardWord = filteredWords[flashcardIndex] || filteredWords[0];
  const currentFlashcardDetail = currentFlashcardWord
    ? lookupWord(currentFlashcardWord, story)
    : null;

  const handleNextFlashcard = () => {
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev + 1) % filteredWords.length);
  };

  const handlePrevFlashcard = () => {
    setIsFlipped(false);
    setFlashcardIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length);
  };

  return (
    <main id="vocabulary-page-main" className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28">
      {/* Page Header Card */}
      <div className={`rounded-3xl p-6 sm:p-8 border mb-6 transition-colors ${cardBgClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Sổ Từ Của Tôi
              </h2>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/15 via-violet-500/15 to-purple-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 shadow-2xs">
                {totalWords} từ đã lưu
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Ôn luyện từ vựng qua danh sách chi tiết hoặc lật thẻ Flashcard thông minh.
            </p>
          </div>

          {/* Quick Stats & Mastery Bar - Eye catching colored cards */}
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-800/90 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 self-start md:self-auto shadow-2xs">
            <div className="text-center px-3 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800">
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-wider">Đang học</div>
              <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">{learningWords.length}</div>
            </div>

            <div className="text-center px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-wider">Đã nhớ</div>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{knownWords.length}</div>
            </div>

            <div className="text-center px-3 py-1.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800">
              <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-black tracking-wider">Tỷ lệ thuộc</div>
              <div className="text-lg font-black text-amber-700 dark:text-amber-300">{masteryRate}%</div>
            </div>
          </div>
        </div>

        {/* Controls Row: Subtabs + View Mode Toggle + Search */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Subtabs: Learning vs Known */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <button
              id="subtab-learning"
              type="button"
              onClick={() => {
                setActiveSubTab('learning');
                setFlashcardIndex(0);
                setIsFlipped(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'learning'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 fill-current text-indigo-600 dark:text-indigo-400" />
              <span>Đang học ({learningWords.length})</span>
            </button>

            <button
              id="subtab-known"
              type="button"
              onClick={() => {
                setActiveSubTab('known');
                setFlashcardIndex(0);
                setIsFlipped(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'known'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Đã nhớ ({knownWords.length})</span>
            </button>
          </div>

          {/* View mode switcher: List vs Flashcards */}
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>Danh sách</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('flashcard');
                setIsFlipped(false);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'flashcard'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Thẻ Flashcard</span>
            </button>
          </div>
        </div>

        {/* Search bar */}
        {currentList.length > 0 && (
          <div className="relative mt-4">
            <Search className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="vocab-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFlashcardIndex(0);
              }}
              placeholder="Tìm kiếm từ vựng, phiên âm IPA, nghĩa tiếng Việt..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredWords.length === 0 && (
        <div
          id="vocab-empty-state"
          className={`rounded-3xl p-10 border-2 border-dashed text-center transition-colors shadow-xs ${
            isDark
              ? 'bg-slate-900/60 border-slate-700 text-slate-300'
              : 'bg-white border-slate-300 text-slate-700'
          }`}
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-violet-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-indigo-500/20">
            <BookOpen className="w-8 h-8 stroke-[2.2]" />
          </div>

          {currentList.length === 0 ? (
            <>
              <h3 className="text-lg font-black mb-1.5">
                {activeSubTab === 'learning'
                  ? 'Chưa có từ vựng nào trong danh sách Đang học'
                  : 'Chưa có từ nào được chuyển sang Đã nhớ'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                Khi đọc truyện, hãy chạm vào bất kỳ từ nào bạn muốn ghi nhớ và bấm nút &ldquo;Lưu học từ&rdquo;. Từ đó sẽ xuất hiện ở đây để bạn ôn luyện hàng ngày!
              </p>
              <button
                id="btn-switch-to-reading"
                type="button"
                onClick={onSwitchToReading}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black px-6 py-3 rounded-2xl shadow-md shadow-indigo-500/25 transition cursor-pointer active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>Quay lại đọc bài ngay</span>
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Không tìm thấy từ vựng nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;.
            </p>
          )}
        </div>
      )}

      {/* VIEW MODE: INTERACTIVE FLASHCARD - EYE CATCHING DESIGN */}
      {viewMode === 'flashcard' && filteredWords.length > 0 && currentFlashcardDetail && (
        <div className="max-w-lg mx-auto mb-10">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3 px-2 font-semibold">
            <span>
              Thẻ <strong>{flashcardIndex + 1}</strong> / {filteredWords.length}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Chạm vào thẻ để lật mặt xem nghĩa</span>
          </div>

          {/* Flip Flashcard Box */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className={`min-h-[290px] rounded-3xl border p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl active:scale-98 ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-slate-100'
                : isSepia
                  ? 'bg-gradient-to-br from-[#FAF6EE] to-amber-50/70 border-amber-900/15 text-stone-900'
                  : 'bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 border-slate-200 text-slate-900'
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 shadow-2xs">
                {isFlipped ? 'Mặt sau (Định nghĩa & Ví dụ)' : 'Mặt trước (Tiếng Anh & Phát âm)'}
              </span>
              <button
                type="button"
                onClick={(e) => handleSpeak(currentFlashcardWord, e)}
                className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition shadow-xs"
              >
                <Volume2 className="w-5 h-5 stroke-[2.3]" />
              </button>
            </div>

            {/* Center Content */}
            <div className="text-center py-6">
              {!isFlipped ? (
                <>
                  <h3 className="text-3xl sm:text-4xl font-black capitalize mb-2 tracking-tight">
                    {currentFlashcardDetail.word}
                  </h3>
                  <div className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                    {currentFlashcardDetail.ipa}
                  </div>
                  {currentFlashcardDetail.partOfSpeech && (
                    <div className="text-xs text-violet-600 dark:text-violet-400 font-semibold italic mt-1">
                      {currentFlashcardDetail.partOfSpeech}
                    </div>
                  )}
                  <div className="mt-4 text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
                    <RotateCw className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Bấm vào thẻ để xem nghĩa tiếng Việt</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-500 mb-1">
                    Nghĩa Tiếng Việt
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300 mb-3">
                    {currentFlashcardDetail.vietnameseMeaning}
                  </h3>
                  {currentFlashcardDetail.exampleSentence && (
                    <p className="text-xs italic text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 max-w-sm mx-auto shadow-2xs">
                      &ldquo;{currentFlashcardDetail.exampleSentence}&rdquo;
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Bottom action inside flashcard */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Lật thẻ để kiểm tra</span>
              {activeSubTab === 'learning' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRemembered(currentFlashcardWord);
                    if (filteredWords.length > 1) {
                      setFlashcardIndex((prev) => Math.min(prev, filteredWords.length - 2));
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                >
                  <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Đã thuộc từ này</span>
                </button>
              )}
            </div>
          </div>

          {/* Flashcard Prev / Next buttons */}
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={handlePrevFlashcard}
              className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Thẻ trước</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Lật thẻ</span>
            </button>

            <button
              type="button"
              onClick={handleNextFlashcard}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
            >
              <span>Thẻ tiếp theo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE: DETAILED VOCABULARY LIST */}
      {viewMode === 'list' && filteredWords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWords.map((wordStr) => {
            const detail = lookupWord(wordStr, story);
            const isPlaying = playingWord === wordStr;

            return (
              <div
                key={`vocab-card-${wordStr}`}
                id={`vocab-card-${wordStr}`}
                className={`rounded-3xl p-5 border transition duration-200 flex flex-col justify-between hover:shadow-md ${cardBgClass}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black capitalize">
                          {detail.word}
                        </h3>
                        <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800">
                          {detail.ipa}
                        </span>
                        {detail.isKeyword && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Từ khóa
                          </span>
                        )}
                      </div>
                      {detail.partOfSpeech && (
                        <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold italic mt-0.5">
                          {detail.partOfSpeech}
                        </p>
                      )}
                    </div>

                    {/* Audio pronounce button */}
                    <button
                      id={`btn-listen-${wordStr}`}
                      type="button"
                      onClick={() => handleSpeak(wordStr)}
                      title="Nghe phát âm chuẩn"
                      className={`p-2.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 shadow-2xs ${
                        isPlaying
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm scale-105'
                          : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                      }`}
                    >
                      <Volume2 className="w-4 h-4 stroke-[2.3]" />
                    </button>
                  </div>

                  {/* Meaning box */}
                  <div
                    className={`rounded-2xl p-3.5 mb-3 border ${
                      isDark
                        ? 'bg-slate-800/80 border-slate-700'
                        : 'bg-gradient-to-r from-indigo-50/80 to-slate-50 border-indigo-100'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-0.5">
                      Nghĩa tiếng Việt
                    </p>
                    <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                      {detail.vietnameseMeaning}
                    </p>
                  </div>

                  {/* Context sentence */}
                  {detail.exampleSentence && (
                    <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 text-xs space-y-1 mb-3">
                      <p className="italic text-slate-700 dark:text-slate-300">
                        &ldquo;{detail.exampleSentence}&rdquo;
                      </p>
                      {detail.exampleTranslation && (
                        <p className="text-[11px] text-slate-400">
                          {detail.exampleTranslation}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer: Mark as remembered */}
                {activeSubTab === 'learning' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      id={`btn-remembered-${wordStr}`}
                      type="button"
                      onClick={() => onMarkAsRemembered(wordStr)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Đánh dấu Đã nhớ</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
