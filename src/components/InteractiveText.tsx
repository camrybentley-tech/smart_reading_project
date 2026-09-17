import React, { useState } from 'react';
import { lookupWord } from '../data/storyData';
import { SelectedWordInfo, Story, ReadingAppearance } from '../types';
import { speakEnglish, cleanWord, unlockAudio } from '../utils/speech';
import { parseParagraphSegments } from '../utils/storyHtml';
import { Volume2, Loader2, Check } from 'lucide-react';

interface InteractiveTextProps {
  text: string;
  html?: string;
  paragraphId: string;
  knownWords: string[];
  learningWords: string[];
  requiredKeywordProgress?: Record<string, 'learned' | 'pending'>;
  wordHighlights?: Record<string, 'correct' | 'practice' | 'omitted'>;
  selectedWord: SelectedWordInfo | null;
  speechRate: number;
  story?: Story;
  appearance?: ReadingAppearance;
  onSelectWord: (info: SelectedWordInfo) => void;
}

export const InteractiveText: React.FC<InteractiveTextProps> = ({
  text,
  html,
  paragraphId,
  knownWords,
  learningWords,
  requiredKeywordProgress = {},
  selectedWord,
  speechRate,
  story,
  appearance,
  onSelectWord,
}) => {
  const [isSpeakingPara, setIsSpeakingPara] = useState(false);
  const lastTouchTimestampRef = React.useRef<number>(0);

  // Parse HTML into segments (bold phrases vs ordinary text)
  const segments = React.useMemo(() => {
    if (html && /<(?:strong|b)[^>]*>/i.test(html)) {
      return parseParagraphSegments(html);
    }
    return [{ type: 'text' as const, content: text }];
  }, [html, text]);

  const activateInteractiveItem = (
    target: HTMLElement,
    token: string,
    isRequired: boolean,
    requiredId?: string,
  ) => {
    const cleaned = cleanWord(token);
    if (!cleaned) return;

    unlockAudio();

    const rect = target.getBoundingClientRect();
    const detail = lookupWord(cleaned, story);

    // Speak native TTS immediately
    speakEnglish(cleaned, speechRate);

    // Notify parent to open popup
    onSelectWord({
      word: cleaned,
      rawText: token,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
      detail: {
        ...detail,
        isKeyword: isRequired || detail.isKeyword,
      },
      isRequiredKeyword: isRequired,
      requiredKeywordId: requiredId || cleaned.toLowerCase(),
    });
  };

  // Dynamic typography classes based on appearance settings
  const fontClass = appearance?.fontFamily === 'sans' ? 'font-sans' : 'font-serif';

  const fontSizeClass =
    appearance?.fontSize === 'sm'
      ? 'text-[17px] sm:text-[19px]'
      : appearance?.fontSize === 'lg'
        ? 'text-[21px] sm:text-[24px]'
        : appearance?.fontSize === 'xl'
          ? 'text-[23px] sm:text-[27px]'
          : 'text-[19px] sm:text-[22px]'; // default 'md'

  const lineSpacingClass =
    appearance?.lineSpacing === 'compact'
      ? 'leading-[1.8] sm:leading-[1.9]'
      : appearance?.lineSpacing === 'relaxed'
        ? 'leading-[2.4] sm:leading-[2.6]'
        : 'leading-[2.1] sm:leading-[2.3]'; // default 'normal'

  const isDark = appearance?.theme === 'dark';
  const isSepia = appearance?.theme === 'sepia';

  const textColor = isDark
    ? 'text-slate-100'
    : isSepia
      ? 'text-stone-900'
      : 'text-slate-900';

  return (
    <div className="relative group/p mb-7 sm:mb-8">
      <p
        id={`paragraph-${paragraphId}`}
        className={`${fontClass} ${fontSizeClass} ${lineSpacingClass} ${textColor} font-normal tracking-wide pl-10 sm:pl-12 relative transition-all duration-150`}
      >
        {/* Paragraph Audio Player Button */}
        <button
          type="button"
          id={`btn-speak-paragraph-${paragraphId}`}
          onClick={(e) => {
            e.stopPropagation();
            speakEnglish(text, speechRate, (loading) => setIsSpeakingPara(loading));
          }}
          title="Nghe phát âm cả câu này"
          aria-label="Nghe câu"
          className={`absolute left-0 top-1 p-2 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 ${
            isSpeakingPara
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md ring-4 ring-indigo-400/30 scale-105'
              : isDark
                ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                : isSepia
                  ? 'bg-amber-100/90 text-amber-900 hover:bg-amber-200'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900'
          }`}
        >
          {isSpeakingPara ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Volume2 className="w-4 h-4 stroke-[2.3]" />
          )}
        </button>

        {/* Render Paragraph Segments */}
        {segments.map((seg, segIdx) => {
          if (seg.type === 'bold') {
            // Bold required keyword or phrase (e.g. "take responsibility")
            const kwId = seg.keywordId;
            const isLearned = requiredKeywordProgress[kwId] === 'learned' || learningWords.includes(kwId);
            const isSelected =
              selectedWord?.word.toLowerCase() === kwId ||
              selectedWord?.requiredKeywordId === kwId;

            let boldClasses =
              'inline-flex items-center gap-1.5 cursor-pointer font-bold select-none transition-all duration-150 rounded-lg px-2 py-0.5 mx-0.5 touch-manipulation align-baseline shadow-2xs ';

            if (isSelected) {
              boldClasses += isDark
                ? 'bg-indigo-600 text-white ring-4 ring-indigo-400/40 shadow-md scale-103'
                : 'bg-indigo-600 text-white ring-4 ring-indigo-400/30 shadow-md scale-103';
            } else if (isLearned) {
              boldClasses += isDark
                ? 'bg-emerald-950/70 text-emerald-200 border-2 border-emerald-600/70 hover:bg-emerald-900/80'
                : 'bg-emerald-100 text-emerald-950 border-2 border-emerald-400 hover:bg-emerald-200';
            } else {
              boldClasses += isDark
                ? 'bg-amber-950/70 text-amber-200 border-2 border-amber-500 hover:bg-amber-900/80'
                : 'bg-amber-100 text-amber-950 border-2 border-amber-400 hover:bg-amber-200';
            }

            return (
              <strong
                key={`p-${paragraphId}-bold-${segIdx}`}
                id={`req-keyword-${paragraphId}-${kwId.replace(/\s+/g, '-')}`}
                className={boldClasses}
                onClick={(e) => {
                  if (Date.now() - lastTouchTimestampRef.current < 450) return;
                  activateInteractiveItem(e.currentTarget, seg.cleaned, true, kwId);
                }}
                onTouchEnd={(e) => {
                  lastTouchTimestampRef.current = Date.now();
                  activateInteractiveItem(e.currentTarget, seg.cleaned, true, kwId);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Từ khóa bắt buộc: ${seg.cleaned}${isLearned ? ' (Đã học)' : ' (Chưa học)'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activateInteractiveItem(e.currentTarget, seg.cleaned, true, kwId);
                  }
                }}
              >
                <span>{seg.rawText}</span>
                {isLearned ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
              </strong>
            );
          }

          // Ordinary text segment: tokenize into words and punctuation
          const tokens = seg.content.split(/([a-zA-Z0-9]+(?:['’][a-zA-Z0-9]+)?)/g);

          return (
            <React.Fragment key={`p-${paragraphId}-seg-${segIdx}`}>
              {tokens.map((token, tIdx) => {
                const cleaned = cleanWord(token);
                const isWord = /^[a-zA-Z0-9]/.test(token) && cleaned.length > 0;

                if (!isWord) {
                  return (
                    <span key={`p-${paragraphId}-s-${segIdx}-t-${tIdx}`}>
                      {token}
                    </span>
                  );
                }

                const lowerClean = cleaned.toLowerCase();
                const isKnown = knownWords.includes(lowerClean);
                const isLearning = learningWords.includes(lowerClean);
                const isSelected = selectedWord?.word.toLowerCase() === lowerClean;

                const isRequiredKeyword = story?.requiredKeywords?.some(
                  (rk) => rk.id.toLowerCase() === lowerClean,
                );
                const isRequiredLearned =
                  requiredKeywordProgress[lowerClean] === 'learned' || isLearning;

                let styleClasses =
                  'cursor-pointer transition-all duration-150 inline-block select-none rounded-md px-1 ';

                if (isSelected) {
                  styleClasses += isDark
                    ? 'bg-indigo-600 text-white font-bold ring-4 ring-indigo-400/40 shadow-sm'
                    : 'bg-indigo-600 text-white font-bold ring-4 ring-indigo-400/30 shadow-sm';
                } else if (isRequiredKeyword) {
                  if (isRequiredLearned) {
                    styleClasses += isDark
                      ? 'bg-emerald-950/70 text-emerald-200 font-bold border-2 border-emerald-600/70'
                      : 'bg-emerald-100 text-emerald-950 font-bold border-2 border-emerald-400';
                  } else {
                    styleClasses += isDark
                      ? 'bg-amber-950/70 text-amber-200 font-bold border-2 border-amber-500'
                      : 'bg-amber-100 text-amber-950 font-bold border-2 border-amber-400';
                  }
                } else if (isLearning) {
                  styleClasses += isDark
                    ? 'bg-indigo-950/60 text-indigo-200 font-semibold border-b-2 border-dashed border-indigo-400 hover:bg-indigo-900/60'
                    : 'bg-indigo-50 text-indigo-950 font-semibold border-b-2 border-dashed border-indigo-500 hover:bg-indigo-100';
                } else if (isKnown) {
                  styleClasses += isDark
                    ? 'hover:bg-slate-800 hover:text-emerald-300'
                    : 'hover:bg-emerald-50 hover:text-emerald-900';
                } else {
                  styleClasses += isDark
                    ? 'hover:bg-slate-800 hover:text-white'
                    : 'hover:bg-slate-200/70 hover:text-slate-950';
                }

                return (
                  <span
                    key={`p-${paragraphId}-s-${segIdx}-w-${tIdx}`}
                    onClick={(e) => {
                      if (Date.now() - lastTouchTimestampRef.current < 450) return;
                      activateInteractiveItem(
                        e.currentTarget,
                        token,
                        Boolean(isRequiredKeyword),
                        lowerClean,
                      );
                    }}
                    onTouchEnd={(e) => {
                      lastTouchTimestampRef.current = Date.now();
                      activateInteractiveItem(
                        e.currentTarget,
                        token,
                        Boolean(isRequiredKeyword),
                        lowerClean,
                      );
                    }}
                    className={`${styleClasses} touch-manipulation`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Đọc từ: ${cleaned}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        activateInteractiveItem(
                          e.currentTarget,
                          token,
                          Boolean(isRequiredKeyword),
                          lowerClean,
                        );
                      }
                    }}
                  >
                    {token}
                  </span>
                );
              })}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
};
