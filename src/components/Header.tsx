import React from 'react';
import {
  BookOpen,
  BookmarkCheck,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  GraduationCap,
  Sparkles,
  Type,
  Mic,
  LayoutGrid,
  Shield,
  Flame,
  Zap,
  Award,
  LogOut,
} from 'lucide-react';
import { AppMode, VoiceSettings, StudentTab, ReadingAppearance } from '../types';

interface HeaderProps {
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  studentTab: StudentTab;
  onStudentTabChange: (tab: StudentTab) => void;
  learningCount: number;
  knownCount: number;
  voiceSettings: VoiceSettings;
  appearance: ReadingAppearance;
  onOpenVoiceSettings: () => void;
  onOpenAppearance: () => void;
  onResetProgress: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  onModeChange,
  studentTab,
  onStudentTabChange,
  learningCount,
  knownCount,
  voiceSettings,
  appearance,
  onOpenVoiceSettings,
  onOpenAppearance,
  onResetProgress,
}) => {
  return (
    <header
      id="app-main-header"
      className="sticky top-0 z-50 shadow-lg shadow-purple-950/15 transition-all duration-300 bg-gradient-to-r from-[#7B3FE4] via-[#D33BE8] to-[#04D1EC] text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        {/* ROW 1: BRAND LOGO, TITLE, TAG & TEACHER INFO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Squircle Icon & Title */}
          <div
            onClick={() => {
              if (appMode === 'student') onStudentTabChange('library');
            }}
            className="flex items-center gap-3.5 cursor-pointer group select-none"
            title="Về danh sách kho bài đọc"
          >
            {/* Squircle Book Logo with Star Sparkle */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md ring-2 ring-white/30 shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6 stroke-[2.3]" />
              <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute top-1.5 right-1.5 animate-pulse" />
            </div>

            {/* Title & Tag */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs font-sans">
                  Học Từ Vựng Global Success
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-2xs">
                  Lớp 10
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/90 font-medium tracking-normal mt-0.5">
                Giáo viên: Nguyễn Trương Quỳnh Trang • THPT
              </p>
            </div>
          </div>

          {/* Right: Quick Controls (Voice, Font, Reset) */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Voice Settings Pill */}
            <button
              type="button"
              id="btn-open-voice-settings"
              onClick={onOpenVoiceSettings}
              title="Cài đặt giọng đọc bản xứ"
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-200" />
              <span>
                {voiceSettings.accent === 'en-GB' ? '🇬🇧 UK' : '🇺🇸 US'} {voiceSettings.voice}
              </span>
              <SlidersHorizontal className="w-3 h-3 text-white/80" />
            </button>

            {/* Appearance Pill */}
            <button
              type="button"
              id="btn-open-appearance"
              onClick={onOpenAppearance}
              title="Tùy chỉnh giao diện đọc"
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Aa</span>
            </button>

            {/* Reset / Exit Button */}
            {appMode === 'student' && (
              <button
                type="button"
                id="btn-reset-storage"
                onClick={() => {
                  if (window.confirm('Bạn có muốn đặt lại dữ liệu học từ vựng về ban đầu không?')) {
                    onResetProgress();
                  }
                }}
                title="Đặt lại tiến độ học từ"
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white/90 hover:text-white border border-white/20 backdrop-blur-md shadow-xs transition cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: STATS PILLS, MODE/TAB CHIPS & TEACHER PROFILE BADGE */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Left Badges: Streak, XP, Level */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Streak */}
            <div
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/25 backdrop-blur-md shadow-xs flex items-center gap-1.5 cursor-default select-none"
              title="Chuỗi ngày học liên tục"
            >
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>30 ngày</span>
            </div>

            {/* XP */}
            <div
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/25 backdrop-blur-md shadow-xs flex items-center gap-1.5 cursor-default select-none"
              title="Điểm kinh nghiệm"
            >
              <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span>9999 XP</span>
            </div>

            {/* Level */}
            <div
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/25 backdrop-blur-md shadow-xs flex items-center gap-1.5 cursor-default select-none"
              title="Cấp độ hiện tại"
            >
              <Award className="w-4 h-4 text-emerald-300" />
              <span>Lv.99</span>
            </div>
          </div>

          {/* Center: Navigation & Mode Pills */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Trợ lý AI (Luyện đọc & Nói CEFR) */}
            <button
              type="button"
              id="nav-tab-practice"
              onClick={() => {
                if (appMode !== 'student') onModeChange('student');
                onStudentTabChange('practice');
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 ${
                appMode === 'student' && studentTab === 'practice'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300/50 shadow-blue-900/30'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
              <span>Trợ lý AI</span>
            </button>

            {/* Kho bài */}
            <button
              type="button"
              id="nav-tab-library"
              onClick={() => {
                if (appMode !== 'student') onModeChange('student');
                onStudentTabChange('library');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                appMode === 'student' && studentTab === 'library'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300/50 shadow-md'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kho bài</span>
            </button>

            {/* Đọc bài */}
            <button
              type="button"
              id="nav-tab-reading"
              onClick={() => {
                if (appMode !== 'student') onModeChange('student');
                onStudentTabChange('reading');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                appMode === 'student' && studentTab === 'reading'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300/50 shadow-md'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Đọc bài</span>
            </button>

            {/* Sổ từ */}
            <button
              type="button"
              id="nav-tab-vocabulary"
              onClick={() => {
                if (appMode !== 'student') onModeChange('student');
                onStudentTabChange('vocabulary');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                appMode === 'student' && studentTab === 'vocabulary'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300/50 shadow-md'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Sổ từ</span>
              {learningCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-2xs">
                  {learningCount}
                </span>
              )}
            </button>

            {/* Chế độ Giáo viên [Biên tập] */}
            <button
              type="button"
              id="btn-mode-teacher"
              onClick={() => onModeChange(appMode === 'teacher' ? 'student' : 'teacher')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                appMode === 'teacher'
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow-md font-black'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-md'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${appMode === 'teacher' ? 'text-slate-950' : 'text-emerald-300'}`} />
              <span>Chế độ Giáo viên</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                appMode === 'teacher' ? 'bg-slate-900 text-white' : 'bg-white/25 text-white'
              }`}>
                Biên tập
              </span>
            </button>
          </div>

          {/* Right: Teacher Profile Badge */}
          <div className="hidden xl:flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-white/20 border border-white/25 backdrop-blur-md shrink-0 select-none">
            <div className="w-7 h-7 rounded-full bg-slate-900/80 text-amber-300 border border-white/30 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs font-bold text-white line-clamp-1 max-w-[120px]">
                Nguyễn Trương Qu...
              </div>
              <div className="text-[10px] text-white/80 font-medium">
                Giáo viên / Thẩm định
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
