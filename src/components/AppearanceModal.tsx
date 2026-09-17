import React from 'react';
import { X, Sun, Moon, Coffee, Sliders, Check } from 'lucide-react';
import { ReadingAppearance, ReadingTheme, ReadingFontSize, ReadingFontFamily, ReadingLineSpacing } from '../types';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  appearance: ReadingAppearance;
  onChange: (updated: ReadingAppearance) => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  onClose,
  appearance,
  onChange,
}) => {
  if (!isOpen) return null;

  const themes: Array<{ id: ReadingTheme; label: string; sub: string; icon: React.ReactNode; previewBg: string; previewText: string; border: string }> = [
    {
      id: 'paper',
      label: 'Giấy Trắng',
      sub: 'Trong trẻo, rõ nét',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      previewBg: 'bg-white',
      previewText: 'text-slate-900',
      border: 'border-slate-300',
    },
    {
      id: 'sepia',
      label: 'Hoàng Hôn',
      sub: 'Ấm dịu, bảo vệ mắt',
      icon: <Coffee className="w-4 h-4 text-amber-700" />,
      previewBg: 'bg-[#FAF6EE]',
      previewText: 'text-stone-900',
      border: 'border-amber-400',
    },
    {
      id: 'dark',
      label: 'Đêm Tối',
      sub: 'Tương phản êm dịu',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      previewBg: 'bg-[#0B0F19]',
      previewText: 'text-slate-100',
      border: 'border-slate-700',
    },
  ];

  const fontSizes: Array<{ id: ReadingFontSize; label: string; px: string }> = [
    { id: 'sm', label: 'A-', px: '18px' },
    { id: 'md', label: 'A', px: '21px' },
    { id: 'lg', label: 'A+', px: '24px' },
    { id: 'xl', label: 'A++', px: '27px' },
  ];

  const fontFamilies: Array<{ id: ReadingFontFamily; label: string; sample: string; fontClass: string }> = [
    { id: 'serif', label: 'Lora Serif (Văn học)', sample: 'Aa Bb Cc', fontClass: 'font-serif' },
    { id: 'sans', label: 'Jakarta Sans (Hiện đại)', sample: 'Aa Bb Cc', fontClass: 'font-sans' },
  ];

  const lineSpacings: Array<{ id: ReadingLineSpacing; label: string; value: string }> = [
    { id: 'compact', label: 'Gọn gàng', value: '1.8' },
    { id: 'normal', label: 'Tiêu chuẩn', value: '2.1' },
    { id: 'relaxed', label: 'Thoáng đãng', value: '2.4' },
  ];

  return (
    <div
      id="appearance-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="appearance-modal-card"
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">Tùy chỉnh đọc truyện</h3>
              <p className="text-xs text-slate-500 font-medium">Giao diện, cỡ chữ & khoảng cách đọc</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              Chế độ màu đọc
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {themes.map((t) => {
                const isActive = appearance.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange({ ...appearance, theme: t.id })}
                    className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                      isActive
                        ? 'ring-2 ring-indigo-600 border-indigo-600 shadow-md shadow-indigo-500/15'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-full h-9 rounded-xl mb-2 flex items-center justify-center shadow-xs border ${t.border} ${t.previewBg} ${t.previewText}`}
                    >
                      {t.icon}
                    </div>
                    <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                      <span>{t.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{t.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Cỡ chữ đọc ({appearance.fontSize.toUpperCase()})
              </label>
              <span className="text-xs font-mono font-bold text-indigo-600">
                {fontSizes.find((f) => f.id === appearance.fontSize)?.px}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
              {fontSizes.map((f) => {
                const isActive = appearance.fontSize === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange({ ...appearance, fontSize: f.id })}
                    className={`py-2 rounded-xl text-sm font-black transition flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              Kiểu chữ (Font)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {fontFamilies.map((fam) => {
                const isActive = appearance.fontFamily === fam.id;
                return (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => onChange({ ...appearance, fontFamily: fam.id })}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-black mb-1 flex items-center justify-between">
                      <span>{fam.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                    </div>
                    <div className={`text-base ${fam.fontClass} text-slate-800`}>
                      {fam.sample}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Line spacing */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              Dãn dòng
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
              {lineSpacings.map((sp) => {
                const isActive = appearance.lineSpacing === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => onChange({ ...appearance, lineSpacing: sp.id })}
                    className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{sp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
