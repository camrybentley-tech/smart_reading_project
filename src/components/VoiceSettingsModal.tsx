import React, { useState } from 'react';
import { X, Volume2, Check, Sparkles, Loader2 } from 'lucide-react';
import { VoiceSettings, VoiceAccent } from '../types';
import { AVAILABLE_VOICES, saveVoiceSettings, speakEnglishWithGemini } from '../utils/speech';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [accent, setAccent] = useState<VoiceAccent>(settings.accent);
  const [voice, setVoice] = useState<string>(settings.voice);
  const [speed, setSpeed] = useState<'normal' | 'slow'>(settings.speed);
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  if (!isOpen) return null;

  const handleTestVoice = async () => {
    setIsTestingAudio(true);
    const sampleSentence =
      accent === 'en-GB'
        ? 'Welcome to your interactive English reading journey. Have a splendid day!'
        : 'Welcome to your interactive English reading journey. Practice a little every day!';

    try {
      await speakEnglishWithGemini(sampleSentence, {
        accent,
        voice,
        speed,
        onLoadingChange: (loading) => setIsTestingAudio(loading),
      });
    } finally {
      setIsTestingAudio(false);
    }
  };

  const handleSave = () => {
    const updated: VoiceSettings = { accent, voice, speed };
    saveVoiceSettings(updated);
    onUpdateSettings(updated);
    onClose();
  };

  return (
    <div
      id="voice-settings-overlay"
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="voice-settings-modal"
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Cài đặt giọng đọc bản xứ</h3>
              <p className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Gemini Native English TTS Engine</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Accent choice */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Giọng điệu (Accent)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="btn-accent-us"
                onClick={() => setAccent('en-US')}
                className={`py-3 px-3.5 rounded-2xl border text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs ${
                  accent === 'en-US'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/25 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span>🇺🇸 American (US)</span>
                {accent === 'en-US' && <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />}
              </button>

              <button
                type="button"
                id="btn-accent-gb"
                onClick={() => setAccent('en-GB')}
                className={`py-3 px-3.5 rounded-2xl border text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs ${
                  accent === 'en-GB'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/25 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span>🇬🇧 British (UK)</span>
                {accent === 'en-GB' && <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Voice selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Chọn chất giọng đọc (Gemini Voice)
            </label>
            <div className="space-y-2">
              {AVAILABLE_VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  id={`voice-option-${v.id}`}
                  onClick={() => setVoice(v.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                    voice === v.id
                      ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 text-slate-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-black text-sm text-slate-900">{v.label}</div>
                    <div className="text-xs text-slate-500 font-medium">{v.desc}</div>
                  </div>
                  {voice === v.id && (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Speed selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Tốc độ đọc câu / đoạn văn
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="btn-speed-normal"
                onClick={() => setSpeed('normal')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  speed === 'normal'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>Bình thường (1.0x)</span>
              </button>
              <button
                type="button"
                id="btn-speed-slow"
                onClick={() => setSpeed('slow')}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  speed === 'slow'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>Chậm rãi (0.8x)</span>
              </button>
            </div>
          </div>

          {/* Preview test button */}
          <div className="pt-1">
            <button
              type="button"
              id="btn-test-gemini-voice"
              onClick={handleTestVoice}
              disabled={isTestingAudio}
              className="w-full py-3 px-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {isTestingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                  <span>Đang tạo giọng đọc bản xứ chuẩn AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Nghe thử câu thoại mẫu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            id="btn-confirm-voice-settings"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-md shadow-indigo-500/20 transition active:scale-95 cursor-pointer"
          >
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
};
