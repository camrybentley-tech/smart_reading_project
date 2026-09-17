import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Check, BookmarkPlus, X, Sparkles, Loader2, BookOpen, Volume1, Turtle } from 'lucide-react';
import { SelectedWordInfo, WordStatus, ReadingAppearance, VoiceAccent } from '../types';
import { speakEnglish, speakWordWithAccent, loadVoiceSettings } from '../utils/speech';

interface VocabularyPopupProps {
  selectedWord: SelectedWordInfo | null;
  wordStatus: WordStatus;
  speechRate: number;
  appearance?: ReadingAppearance;
  isRequiredKeyword?: boolean;
  isRequiredLearned?: boolean;
  onMarkKnown: (word: string) => void;
  onMarkLearning: (word: string) => void;
  onClose: () => void;
}

export const VocabularyPopup: React.FC<VocabularyPopupProps> = ({
  selectedWord,
  wordStatus,
  speechRate,
  appearance,
  isRequiredKeyword = false,
  onMarkKnown,
  onMarkLearning,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: false,
  });

  const [activeSpeakingAccent, setActiveSpeakingAccent] = useState<VoiceAccent | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isPlayingExample, setIsPlayingExample] = useState(false);

  // Load initial preferred accent
  const defaultAccent = loadVoiceSettings().accent;

  // Position calculation with viewport boundaries
  useEffect(() => {
    if (!selectedWord) return;

    const { rect } = selectedWord;
    const popupWidth = Math.min(390, window.innerWidth - 32);
    const estimatedPopupHeight = 360;
    const margin = 12;

    // Center horizontally on the word, clamped to screen margins
    let left = rect.left + rect.width / 2 - popupWidth / 2;
    if (left < 16) left = 16;
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16;
    }

    // Determine whether to place above or below the word
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < estimatedPopupHeight && spaceAbove > spaceBelow;

    let top = placeAbove
      ? rect.top - estimatedPopupHeight - margin
      : rect.bottom + margin;

    // Safety clamp
    if (top < 16) top = 16;
    if (top + estimatedPopupHeight > window.innerHeight - 16) {
      top = window.innerHeight - estimatedPopupHeight - 16;
    }

    setPosition({ top, left, placeAbove });
  }, [selectedWord]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (popupRef.current && popupRef.current.contains(event.target as Node)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && target.closest('.story-text')) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!selectedWord) return null;

  const { word, detail } = selectedWord;
  const isDark = appearance?.theme === 'dark';

  // Speak word with authentic native speaker voice in chosen accent
  const handlePronounce = (accent: VoiceAccent, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    setActiveSpeakingAccent(accent);
    const speed = isSlowMode ? 'slow' : 'normal';

    speakWordWithAccent(word, accent, speed, (loading) => {
      setIsLoadingAudio(loading);
    })
      .then(() => {
        setTimeout(() => setActiveSpeakingAccent(null), isSlowMode ? 1400 : 950);
      })
      .catch(() => {
        setActiveSpeakingAccent(null);
      });
  };

  const handlePronounceExample = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!detail.exampleSentence) return;
    setIsPlayingExample(true);
    speakEnglish(detail.exampleSentence, isSlowMode ? 0.78 : speechRate);
    setTimeout(() => setIsPlayingExample(false), 2200);
  };

  const isLearning = wordStatus === 'learning';
  const isKnown = wordStatus === 'known';

  return (
    <div
      id="vocabulary-popup-container"
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: '390px',
        width: 'calc(100vw - 32px)',
        zIndex: 50,
      }}
      className={`rounded-3xl shadow-2xl border backdrop-blur-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-150 transition-colors ${
        isDark
          ? 'bg-slate-900/95 border-slate-700 shadow-black/80 text-slate-100'
          : 'bg-white/95 border-purple-200/90 shadow-purple-900/20 text-slate-900'
      }`}
    >
      {/* Top row: Word, IPA, Close button */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl sm:text-[28px] font-black tracking-tight capitalize font-sans">
              {word}
            </span>
            {(isRequiredKeyword || detail.isKeyword) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Từ khóa bài</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800">
              {detail.ipa}
            </span>
            {detail.partOfSpeech && (
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 px-2 py-0.5 rounded-md italic">
                {detail.partOfSpeech}
              </span>
            )}
            {detail.baseWord && detail.baseWord.toLowerCase() !== word.toLowerCase() && (
              <span className="text-[11px] text-slate-400">
                (từ gốc: <span className="font-semibold text-slate-600 dark:text-slate-300">{detail.baseWord}</span>)
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          id="popup-close-btn"
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* DUAL NATIVE ACCENT PRONUNCIATION BAR (US & UK) */}
      <div className="my-3 p-2 rounded-2xl bg-gradient-to-r from-violet-50/90 via-indigo-50/70 to-fuchsia-50/80 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-indigo-950/40 border border-violet-100 dark:border-slate-700/80">
        <div className="flex items-center justify-between gap-1 mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Phát âm chuẩn bản ngữ (Native Studio Audio)
            </span>
          </div>
          {/* Slow speed toggle */}
          <button
            type="button"
            id="toggle-slow-audio"
            onClick={(e) => {
              e.stopPropagation();
              setIsSlowMode(!isSlowMode);
            }}
            title="Bật/Tắt đọc chậm để nghe rõ từng âm tiết"
            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg transition cursor-pointer ${
              isSlowMode
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60'
            }`}
          >
            <Turtle className="w-3 h-3" />
            <span>Chậm 0.75x</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* US Native Voice Button */}
          <button
            type="button"
            id="popup-listen-us-btn"
            onClick={(e) => handlePronounce('en-US', e)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs ${
              activeSpeakingAccent === 'en-US'
                ? 'bg-gradient-to-r from-[#7B3FE4] to-[#D33BE8] text-white shadow-md ring-2 ring-purple-300'
                : 'bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-purple-100 dark:border-slate-700'
            }`}
          >
            <span className="text-sm">🇺🇸</span>
            <span className="font-black">US (Mỹ)</span>
            {activeSpeakingAccent === 'en-US' ? (
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-white rounded-full animate-bounce h-2" />
                <span className="w-0.5 bg-white rounded-full animate-bounce delay-75 h-3" />
                <span className="w-0.5 bg-white rounded-full animate-bounce delay-150 h-1.5" />
              </div>
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            )}
          </button>

          {/* UK Native Voice Button */}
          <button
            type="button"
            id="popup-listen-uk-btn"
            onClick={(e) => handlePronounce('en-GB', e)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs ${
              activeSpeakingAccent === 'en-GB'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-indigo-100 dark:border-slate-700'
            }`}
          >
            <span className="text-sm">🇬🇧</span>
            <span className="font-black">UK (Anh)</span>
            {activeSpeakingAccent === 'en-GB' ? (
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-white rounded-full animate-bounce h-2" />
                <span className="w-0.5 bg-white rounded-full animate-bounce delay-75 h-3" />
                <span className="w-0.5 bg-white rounded-full animate-bounce delay-150 h-1.5" />
              </div>
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            )}
          </button>
        </div>
      </div>

      {/* Vietnamese Definition Card - Eye Catching Saturated Box */}
      <div
        id="popup-definition-box"
        className={`p-3.5 rounded-2xl mb-3 border transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-800 to-indigo-950/40 border-indigo-900/50'
            : 'bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/70 border-purple-100'
        }`}
      >
        <div className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">
          Nghĩa tiếng Việt
        </div>
        <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
          {detail.vietnameseMeaning}
        </div>
      </div>

      {/* Contextual Example Sentence */}
      {detail.exampleSentence && (
        <div className="mb-3.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Ví dụ ngữ cảnh:</span>
            </span>
            <button
              type="button"
              onClick={handlePronounceExample}
              className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer font-extrabold"
            >
              <Volume1 className="w-3.5 h-3.5" />
              <span>{isPlayingExample ? 'Đang đọc...' : 'Nghe ví dụ bản ngữ'}</span>
            </button>
          </div>
          <p className="text-xs italic text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 leading-relaxed">
            &ldquo;{detail.exampleSentence}&rdquo;
            {detail.exampleTranslation && (
              <span className="block not-italic text-slate-500 dark:text-slate-400 mt-1 font-medium text-[11px]">
                {detail.exampleTranslation}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Action Buttons: ĐÃ BIẾT vs HỌC TỪ NÀY */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          id="btn-mark-known"
          type="button"
          onClick={() => onMarkKnown(word)}
          className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border shadow-2xs ${
            isKnown
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
              : isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-emerald-50/70 text-slate-700 border-slate-300 hover:border-emerald-300'
          }`}
        >
          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
          <span>{isKnown ? 'Đã biết ✓' : 'Đã biết'}</span>
        </button>

        <button
          id="btn-mark-learning"
          type="button"
          onClick={() => onMarkLearning(word)}
          className={`py-2.5 px-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md ${
            isLearning
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-purple-600/30'
              : 'bg-gradient-to-r from-[#7B3FE4] via-[#D33BE8] to-[#04D1EC] hover:opacity-95 text-white shadow-purple-500/25'
          }`}
        >
          <BookmarkPlus className="w-4 h-4 text-amber-200 stroke-[2.5]" />
          <span>{isLearning ? 'Đang học ✓' : 'Lưu học từ'}</span>
        </button>
      </div>
    </div>
  );
};
