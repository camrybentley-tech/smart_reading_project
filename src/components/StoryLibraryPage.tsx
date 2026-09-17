import React, { useState } from 'react';
import {
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Clock,
  BookMarked,
  Search,
  Filter,
  PlusCircle,
  Mic,
  BookmarkCheck,
  RotateCcw,
  Headphones,
} from 'lucide-react';
import { Story, ReadingAppearance, VoiceSettings } from '../types';
import { speakEnglishWithGemini, stopSpeech } from '../utils/speech';

interface StoryLibraryPageProps {
  stories: Story[];
  activeStoryId: string;
  appearance: ReadingAppearance;
  voiceSettings: VoiceSettings;
  storyProgressMap: Record<string, Record<string, 'learned' | 'pending'>>;
  onSelectStory: (storyId: string, directTab?: 'reading' | 'practice' | 'vocabulary') => void;
  onCreateNewStory: () => void;
  onResetStoryProgress?: (storyId: string) => void;
}

export const StoryLibraryPage: React.FC<StoryLibraryPageProps> = ({
  stories,
  activeStoryId,
  appearance,
  voiceSettings,
  storyProgressMap,
  onSelectStory,
  onCreateNewStory,
  onResetStoryProgress,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Audio preview state for cards
  const [playingStoryId, setPlayingStoryId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const isDark = appearance.theme === 'dark';
  const isSepia = appearance.theme === 'sepia';

  const cardBg = isDark
    ? 'bg-slate-900/95 border-slate-800 text-slate-100 hover:border-indigo-500/50'
    : isSepia
      ? 'bg-[#FCF8F2] border-amber-900/15 text-stone-900 hover:border-amber-500/50'
      : 'bg-white border-slate-200/90 text-slate-900 hover:border-indigo-400/70 shadow-sm hover:shadow-md';

  // Handle playing audio preview for a story card
  const handleToggleStoryAudio = async (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingStoryId === story.id) {
      stopSpeech();
      setPlayingStoryId(null);
      setIsLoadingAudio(false);
      return;
    }

    stopSpeech();
    setPlayingStoryId(story.id);
    setIsLoadingAudio(true);

    try {
      // Speak the story title and paragraphs
      const fullText = `${story.title}. ${story.subtitle ? story.subtitle + '.' : ''} ${story.paragraphs.map((p) => p.text).join(' ')}`;
      await speakEnglishWithGemini(fullText, {
        accent: voiceSettings.accent,
        voice: voiceSettings.voice,
        speed: voiceSettings.speed,
        onLoadingChange: (loading) => setIsLoadingAudio(loading),
      });
    } catch (err) {
      console.error('Audio preview error:', err);
    } finally {
      setPlayingStoryId(null);
      setIsLoadingAudio(false);
    }
  };

  // Calculate story completion stats
  const getStoryStats = (story: Story) => {
    const progress = storyProgressMap[story.id] || {};
    const totalKeywords = story.requiredKeywords?.length || story.keywords?.length || 0;
    if (totalKeywords === 0) return { learnedCount: 0, totalKeywords: 0, percent: 0, isCompleted: false };

    const learnedCount = (story.requiredKeywords || []).filter(
      (k) => progress[k.id.toLowerCase()] === 'learned'
    ).length;

    const percent = Math.round((learnedCount / totalKeywords) * 100);
    const isCompleted = percent >= 100;
    return { learnedCount, totalKeywords, percent, isCompleted };
  };

  // Filtered stories
  const filteredStories = stories.filter((story) => {
    const matchesSearch =
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (story.subtitle && story.subtitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (story.keywords && story.keywords.some((k) => k.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesLevel =
      selectedLevel === 'all' ||
      (selectedLevel === 'a1-a2' && (story.level?.includes('A1') || story.level?.includes('A2') || story.level?.includes('Cơ bản'))) ||
      (selectedLevel === 'b1-b2' && (story.level?.includes('B1') || story.level?.includes('B2') || story.level?.includes('Trung cấp')));

    const stats = getStoryStats(story);
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'completed' && stats.isCompleted) ||
      (selectedStatus === 'learning' && !stats.isCompleted && stats.learnedCount > 0) ||
      (selectedStatus === 'new' && stats.learnedCount === 0);

    return matchesSearch && matchesLevel && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner: Vibrant Hero Header matching Header gradient */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#7B3FE4] via-[#D33BE8] to-[#04D1EC] text-white shadow-xl shadow-purple-900/15 relative overflow-hidden">
        {/* Subtle decorative glow circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-400/20 rounded-full blur-3xl -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/25 text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Kho Bài Đọc Tương Tác Global Success</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight drop-shadow-xs">
              Ô Cửa Sổ Bài Đọc Thông Minh
            </h1>
            <p className="text-sm sm:text-base text-white/95 leading-relaxed font-medium">
              Mỗi bài đọc là một ô cửa sổ riêng biệt. Bạn có thể nhấn <strong className="text-amber-200 font-bold">Nghe bài</strong> trực tiếp trên từng ô hoặc bấm <strong className="text-cyan-200 font-bold">Mở đọc</strong> để tra nghĩa từ vựng và luyện nói theo giọng bản xứ.
            </p>
          </div>

          {/* Quick Action: New Story */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCreateNewStory}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-purple-950 font-black text-xs sm:text-sm transition-all shadow-md shadow-purple-900/20 flex items-center gap-2 cursor-pointer active:scale-95 border border-white/40"
            >
              <PlusCircle className="w-4 h-4 text-purple-600 stroke-[2.5]" />
              <span>Soạn / Thêm bài mới</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-center shadow-xs">
            <span className="block text-xl font-black text-white">{stories.length}</span>
            <span className="text-[11px] text-white/80 font-medium">Tổng bài đọc</span>
          </div>
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-center shadow-xs">
            <span className="block text-xl font-black text-emerald-200">
              {stories.filter((s) => getStoryStats(s).isCompleted).length}
            </span>
            <span className="text-[11px] text-white/80 font-medium">Bài đã thuộc 100%</span>
          </div>
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-center shadow-xs">
            <span className="block text-xl font-black text-amber-200">
              {stories.reduce((acc, s) => acc + (s.requiredKeywords?.length || 0), 0)}
            </span>
            <span className="text-[11px] text-white/80 font-medium">Từ khóa trọng tâm</span>
          </div>
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 text-center shadow-xs">
            <span className="block text-xl font-black text-white">
              {voiceSettings.accent === 'en-GB' ? '🇬🇧 UK' : '🇺🇸 US'}
            </span>
            <span className="text-[11px] text-white/80 font-medium">Giọng {voiceSettings.voice}</span>
          </div>
        </div>
      </div>

      {/* Search & Filters Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm bài đọc theo tên, từ khóa..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 font-bold flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Cấp độ:
          </span>
          <button
            type="button"
            onClick={() => setSelectedLevel('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedLevel === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Tất cả ({stories.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel('a1-a2')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedLevel === 'a1-a2'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
            }`}
          >
            Cơ bản (A1 - A2)
          </button>
          <button
            type="button"
            onClick={() => setSelectedLevel('b1-b2')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedLevel === 'b1-b2'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
            }`}
          >
            Trung cấp (B1 - B2)
          </button>
        </div>
      </div>

      {/* Grid of Story Windows ("Các ô cửa sổ riêng cho từng bài đọc") */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStories.map((story) => {
          const stats = getStoryStats(story);
          const isCurrentActive = story.id === activeStoryId;
          const isThisPlaying = playingStoryId === story.id;

          return (
            <div
              key={story.id}
              className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden flex flex-col group relative ${cardBg} ${
                isCurrentActive ? 'ring-2 ring-indigo-500 shadow-lg' : ''
              }`}
            >
              {/* Active Badge Marker */}
              {isCurrentActive && (
                <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black shadow-md flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>Đang chọn</span>
                </div>
              )}

              {/* Cover Image & Overlay Tags */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={story.coverImage || '/src/assets/images/story_cover_1789397950701.jpg'}
                  alt={story.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

                {/* Level Tag (Top Right) */}
                <div className="absolute top-3 right-3 z-10">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-indigo-700 dark:text-indigo-300 border border-white/20 shadow-xs">
                    {story.level || 'Cơ bản - Trung cấp'}
                  </span>
                </div>

                {/* Bottom Overlay Info on Cover */}
                <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-white text-xs font-semibold">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3 text-amber-300" />
                      ~{Math.max(1, Math.round(story.wordCount / 100))} phút
                    </span>
                    <span className="flex items-center gap-1 text-[11px] bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-md">
                      <BookMarked className="w-3 h-3 text-indigo-300" />
                      {story.wordCount} từ
                    </span>
                  </div>

                  {/* Audio Wave Indicator if currently playing */}
                  {isThisPlaying && (
                    <div className="flex items-center gap-1 bg-rose-600 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse shadow-md">
                      <Headphones className="w-3 h-3" />
                      <span>Đang phát</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Story Content Area */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base font-black tracking-tight line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {story.title}
                  </h3>
                  {story.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                      {story.subtitle}
                    </p>
                  )}

                  {/* Preview of Story Paragraph */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic leading-relaxed pt-1">
                    "{story.paragraphs[0]?.text || ''}"
                  </p>

                  {/* Keywords Pills Preview */}
                  {story.keywords && story.keywords.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-bold">
                        <span>Từ khóa trọng tâm ({story.keywords.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {story.keywords.slice(0, 4).map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                          >
                            {kw}
                          </span>
                        ))}
                        {story.keywords.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-slate-400">
                            +{story.keywords.length - 4} từ
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar for this specific story */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 text-[11px]">Tiến độ nhớ từ khóa:</span>
                    <span
                      className={`text-[11px] font-black ${
                        stats.isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : stats.learnedCount > 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {stats.isCompleted ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Hoàn thành (100%)
                        </span>
                      ) : (
                        `${stats.learnedCount}/${stats.totalKeywords} từ (${stats.percent}%)`
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        stats.isCompleted
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                      }`}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons: Quick Listen & Open Reading Window */}
                <div className="space-y-2 pt-1">
                  {/* Button 1: Quick Audio Listen directly on card */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleStoryAudio(story, e)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-xs border ${
                      isThisPlaying
                        ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-rose-500/25'
                        : 'bg-purple-50 hover:bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200 border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    {isThisPlaying ? (
                      <>
                        <VolumeX className="w-4 h-4 stroke-[2.5]" />
                        <span>Dừng nghe bài đọc</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 stroke-[2.5]" />
                        <span>
                          {isLoadingAudio ? 'Đang tải âm thanh...' : 'Nghe bài đọc ngay (Native TTS)'}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Button 2: Open Dedicated Reading Window */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectStory(story.id, 'reading')}
                      className="col-span-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#4F46E5] hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs transition shadow-md shadow-purple-900/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Mở đọc bài</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectStory(story.id, 'practice')}
                      title="Luyện đọc & Nói AI chuẩn CEFR"
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-[#D33BE8] to-[#9333EA] hover:from-fuchsia-600 hover:to-purple-700 text-white font-black text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Nói AI</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Create New Story Tile */}
        <div
          onClick={onCreateNewStory}
          className={`rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all duration-200 group bg-slate-50/50 hover:bg-indigo-50/30 dark:bg-slate-900/30 dark:hover:bg-indigo-950/20 min-h-[360px]`}
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
            <PlusCircle className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Tạo hoặc Soạn bài đọc mới
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mt-1">
              Thầy cô hoặc học sinh có thể dán truyện tiếng Anh mới, thêm từ khóa và AI sẽ tự động phân tích phát âm!
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-xs">
            + Mở trình soạn bài
          </span>
        </div>
      </div>
    </div>
  );
};
