import React from 'react';
import { CheckCircle2, Bookmark, Sparkles, Award } from 'lucide-react';
import { ReadingAppearance } from '../types';

interface ProgressBarProps {
  knownCount: number;
  learningCount: number;
  totalUniqueWordsEstimate: number;
  appearance?: ReadingAppearance;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  knownCount,
  learningCount,
  totalUniqueWordsEstimate = 110,
  appearance,
}) => {
  const isDark = appearance?.theme === 'dark';
  const isSepia = appearance?.theme === 'sepia';

  const knownPercent = Math.min(100, Math.round((knownCount / totalUniqueWordsEstimate) * 100));
  const learningPercent = Math.min(100, Math.round((learningCount / totalUniqueWordsEstimate) * 100));
  const totalInteractedPercent = Math.min(100, knownPercent + learningPercent);

  const containerBg = isDark
    ? 'bg-slate-900/90 border-slate-800 text-slate-200 shadow-slate-950/40'
    : isSepia
      ? 'bg-[#FAF6EE] border-amber-900/15 text-stone-800 shadow-amber-900/5'
      : 'bg-white border-slate-200/90 text-slate-800 shadow-sm';

  return (
    <div
      id="reading-progress-bar-container"
      className={`border rounded-3xl p-4 sm:p-5 mb-6 backdrop-blur-md transition-all duration-200 ${containerBg}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold mb-3">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Known Words Pill */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 font-extrabold shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
            <span>Đã biết: {knownCount}</span>
          </span>

          {/* Learning Words Pill */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300/80 dark:border-indigo-800 font-extrabold shadow-2xs">
            <Bookmark className="w-4 h-4 fill-current text-indigo-600 dark:text-indigo-400" />
            <span>Đang học: {learningCount}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold">
            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{totalInteractedPercent}% hoàn thành</span>
          </span>
          <span className="hidden md:inline text-slate-400">&bull; Chạm vào từ bất kỳ để tra nghĩa</span>
        </div>
      </div>

      {/* Modern High-Vibrancy Progress Track */}
      <div className="relative w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex shadow-inner">
        <div
          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-l-full shadow-xs"
          style={{ width: `${knownPercent}%` }}
          title={`Đã biết: ${knownCount} từ`}
        />
        <div
          className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500 shadow-xs"
          style={{ width: `${learningPercent}%` }}
          title={`Đang học: ${learningCount} từ`}
        />
      </div>
    </div>
  );
};
