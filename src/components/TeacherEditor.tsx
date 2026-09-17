import React, { useState } from 'react';
import { Story, StoryKeyword, SelectedWordInfo, RequiredKeyword } from '../types';
import {
  calculateStoryWordCount,
  saveActiveStory,
  restoreDefaultStory,
} from '../utils/storage';
import {
  extractRequiredKeywordsFromHtml,
  parseStoryHtmlToParagraphs,
} from '../utils/storyHtml';
import { RichStoryEditor } from './RichStoryEditor';
import { InteractiveText } from './InteractiveText';
import { VocabularyPopup } from './VocabularyPopup';
import {
  FileText,
  Key,
  Eye,
  Sparkles,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  Bookmark,
} from 'lucide-react';
import { speakEnglish } from '../utils/speech';

interface TeacherEditorProps {
  story: Story;
  onUpdateStory: (newStory: Story) => void;
  knownWords: string[];
  learningWords: string[];
  speechRate: number;
}

export const TeacherEditor: React.FC<TeacherEditorProps> = ({
  story,
  onUpdateStory,
  knownWords,
  learningWords,
  speechRate,
}) => {
  const [subTab, setSubTab] = useState<'editor' | 'keywords' | 'preview'>('editor');

  // Story Form state
  const [title, setTitle] = useState(story.title);
  const [subtitle, setSubtitle] = useState(story.subtitle || '');
  const [author, setAuthor] = useState(story.author || 'Giáo viên');
  const [level, setLevel] = useState(story.level || 'THCS / THPT (A2 - B1)');

  // Rich HTML content
  const [contentHtml, setContentHtml] = useState(
    story.contentHtml ||
      story.paragraphs.map((p) => `<p>${p.html || p.text}</p>`).join(''),
  );

  // Completion requirement toggle
  const [requireAllKeywords, setRequireAllKeywords] = useState<boolean>(
    story.requireAllKeywordsBeforeCompletion ?? true,
  );

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Keyword Management state
  const [keywordList, setKeywordList] = useState<StoryKeyword[]>(() => {
    if (story.keywordDetails) {
      return Object.values(story.keywordDetails);
    }
    return story.keywords.map((kw) => ({
      word: kw,
      ipa: `/${kw}/`,
      meaningVi: 'Từ khóa trọng tâm bài học',
    }));
  });

  // New Keyword input state
  const [wordInput, setWordInput] = useState('');
  const [ipaInput, setIpaInput] = useState('');
  const [meaningInput, setMeaningInput] = useState('');
  const [partOfSpeechInput, setPartOfSpeechInput] = useState('');
  const [exampleInput, setExampleInput] = useState('');
  const [exampleViInput, setExampleViInput] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);

  // Preview state
  const [selectedWord, setSelectedWord] = useState<SelectedWordInfo | null>(null);

  // Live parsed paragraphs & statistics from rich HTML
  const currentParagraphs = React.useMemo(() => {
    return parseStoryHtmlToParagraphs(contentHtml);
  }, [contentHtml]);

  const liveWordCount = React.useMemo(() => {
    return calculateStoryWordCount(currentParagraphs);
  }, [currentParagraphs]);

  // Required Keywords state map: id -> RequiredKeyword
  const [requiredKeywordMap, setRequiredKeywordMap] = useState<Record<string, RequiredKeyword>>(() => {
    const map: Record<string, RequiredKeyword> = {};
    if (story.requiredKeywords && Array.isArray(story.requiredKeywords)) {
      story.requiredKeywords.forEach((rk) => {
        if (rk && rk.id) {
          map[rk.id.toLowerCase()] = { ...rk };
        }
      });
    }
    if (story.keywordDetails) {
      Object.entries(story.keywordDetails).forEach(([k, kd]) => {
        const lower = k.toLowerCase();
        if (!map[lower]) {
          map[lower] = {
            id: lower,
            text: kd.word || k,
            required: true,
            meaningVi: kd.meaningVi || '',
            ipa: kd.ipa || '',
            example: kd.example || '',
            exampleVi: kd.exampleVi || '',
            partOfSpeech: kd.partOfSpeech || '',
            teacherEdited: false,
            meaningSource: 'ai',
          };
        }
      });
    }
    return map;
  });

  const [isGeneratingAllMeanings, setIsGeneratingAllMeanings] = useState(false);
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState<Record<string, boolean>>({});

  // Detected bold keywords from current HTML
  const detectedBoldKeywords = React.useMemo(() => {
    return extractRequiredKeywordsFromHtml(contentHtml, Object.values(requiredKeywordMap));
  }, [contentHtml, requiredKeywordMap]);

  // Call backend to generate contextual meanings for given items
  const generateMeaningsForItems = async (
    itemsToGenerate: Array<{ id: string; text: string; contextSentence?: string }>,
    isSingleItem = false,
  ) => {
    if (itemsToGenerate.length === 0) return;

    try {
      const res = await fetch('/api/generate-keyword-meanings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToGenerate,
          storyTitle: title || story.title,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setRequiredKeywordMap((prev) => {
          const next = { ...prev };
          for (const item of data.results) {
            const idLower = item.id.toLowerCase();
            const existing = next[idLower];
            // If it's a batch call, NEVER overwrite teacher-edited meanings
            if (!isSingleItem && existing?.teacherEdited && existing?.meaningVi?.trim()) {
              continue;
            }
            next[idLower] = {
              ...(existing || { id: idLower, text: item.text, required: true }),
              text: item.text || existing?.text || idLower,
              meaningVi: item.meaningVi,
              ipa: item.ipa || existing?.ipa || '',
              meaningSource: 'ai',
              teacherEdited: false,
              contextSentence: existing?.contextSentence || '',
              example: existing?.contextSentence || existing?.example || '',
            };
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to generate keyword meanings:', err);
      throw err;
    }
  };

  // Auto-generate missing meanings when new bold keywords are detected with debounce
  React.useEffect(() => {
    const missing = detectedBoldKeywords.filter((kw) => {
      const entry = requiredKeywordMap[kw.id];
      return !entry?.meaningVi?.trim() && !entry?.teacherEdited;
    });

    if (missing.length === 0 || isGeneratingAllMeanings) {
      return;
    }

    const timer = setTimeout(() => {
      const stillMissing = detectedBoldKeywords.filter((kw) => {
        const entry = requiredKeywordMap[kw.id];
        return !entry?.meaningVi?.trim() && !entry?.teacherEdited;
      });

      if (stillMissing.length > 0 && !isGeneratingAllMeanings) {
        setIsGeneratingAllMeanings(true);
        generateMeaningsForItems(
          stillMissing.map((m) => ({
            id: m.id,
            text: m.text,
            contextSentence: m.contextSentence,
          })),
          false,
        )
          .catch((err) => {
            console.warn('Auto-generation notice (can click button manually):', err);
          })
          .finally(() => {
            setIsGeneratingAllMeanings(false);
          });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [contentHtml, detectedBoldKeywords, requiredKeywordMap, isGeneratingAllMeanings]);

  // Handle teacher editing a keyword's Vietnamese meaning
  const handleUpdateKeywordMeaning = (id: string, newMeaning: string) => {
    const idLower = id.toLowerCase();
    setRequiredKeywordMap((prev) => {
      const existing = prev[idLower] || { id: idLower, text: id, required: true };
      return {
        ...prev,
        [idLower]: {
          ...existing,
          meaningVi: newMeaning,
          teacherEdited: true,
          meaningSource: 'teacher',
        },
      };
    });
  };

  // Generate all missing meanings button handler
  const handleGenerateAllMissingMeanings = async () => {
    const missing = detectedBoldKeywords.filter((kw) => {
      const entry = requiredKeywordMap[kw.id];
      return !entry?.meaningVi || !entry.meaningVi.trim();
    });

    if (missing.length === 0) {
      setSaveSuccessMsg('Tất cả các từ khóa in đậm đều đã có nghĩa tiếng Việt!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      return;
    }

    try {
      setIsGeneratingAllMeanings(true);
      await generateMeaningsForItems(
        missing.map((m) => ({
          id: m.id,
          text: m.text,
          contextSentence: m.contextSentence,
        })),
        false,
      );
      setSaveSuccessMsg(`Đã tạo nghĩa tiếng Việt thành công cho ${missing.length} từ khóa in đậm!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch {
      setSaveSuccessMsg('Đã có lỗi khi kết nối tới AI. Vui lòng bấm thử lại!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } finally {
      setIsGeneratingAllMeanings(false);
    }
  };

  // Single keyword regenerate meaning handler
  const handleRegenerateSingleMeaning = async (kw: RequiredKeyword) => {
    try {
      setIsRegeneratingSingle((prev) => ({ ...prev, [kw.id]: true }));
      await generateMeaningsForItems(
        [
          {
            id: kw.id,
            text: kw.text,
            contextSentence: kw.contextSentence || kw.example,
          },
        ],
        true, // isSingleItem = true, teacher explicitly requested
      );
    } catch {
      setSaveSuccessMsg(`Không thể gợi ý lại cho "${kw.text}". Vui lòng thử lại!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } finally {
      setIsRegeneratingSingle((prev) => ({ ...prev, [kw.id]: false }));
    }
  };

  // Save story content
  const handleSaveStory = () => {
    const paragraphs = parseStoryHtmlToParagraphs(contentHtml);
    const wordCount = calculateStoryWordCount(paragraphs);
    const boldKeywords = extractRequiredKeywordsFromHtml(contentHtml, Object.values(requiredKeywordMap));

    // Compile requiredKeywords from detected bold items and map
    const requiredKeywords: RequiredKeyword[] = boldKeywords.map((bk) => {
      const entry = requiredKeywordMap[bk.id];
      return {
        id: bk.id,
        text: bk.text,
        required: true,
        meaningVi: entry?.meaningVi || '',
        meaningSource: entry?.meaningSource || 'ai',
        teacherEdited: entry?.teacherEdited ?? false,
        ipa: entry?.ipa || '',
        example: bk.contextSentence || entry?.example || '',
        exampleVi: entry?.exampleVi || '',
        partOfSpeech: entry?.partOfSpeech || '',
        contextSentence: bk.contextSentence || entry?.contextSentence || '',
      };
    });

    // Also sync to keywordDetailsRecord
    const keywordDetailsRecord: Record<string, StoryKeyword> = {};
    keywordList.forEach((kw) => {
      keywordDetailsRecord[kw.word.toLowerCase()] = kw;
    });
    requiredKeywords.forEach((rk) => {
      keywordDetailsRecord[rk.id] = {
        word: rk.text,
        ipa: rk.ipa || `/${rk.id}/`,
        meaningVi: rk.meaningVi || 'Từ khóa bắt buộc',
        partOfSpeech: rk.partOfSpeech || 'từ khóa bắt buộc',
        example: rk.contextSentence || rk.example || '',
        exampleVi: rk.exampleVi || '',
      };
    });

    const combinedKeywords = Array.from(
      new Set([...boldKeywords.map((bk) => bk.id), ...keywordList.map((k) => k.word.toLowerCase())]),
    );

    const updated: Story = {
      ...story,
      title: title.trim() || 'Bài đọc tiếng Anh',
      subtitle: subtitle.trim(),
      author: author.trim(),
      level: level.trim(),
      contentHtml: contentHtml.trim(),
      content: paragraphs.map((p) => p.text).join('\n\n'),
      paragraphs,
      wordCount,
      keywords: combinedKeywords,
      requiredKeywords,
      requireAllKeywordsBeforeCompletion: requireAllKeywords,
      keywordDetails: keywordDetailsRecord,
    };

    saveActiveStory(updated);
    onUpdateStory(updated);

    setSaveSuccessMsg(
      `Đã lưu bài đọc thành công! Đã lưu ${requiredKeywords.length} từ khóa bắt buộc cùng nghĩa tiếng Việt.`,
    );
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Restore default sample story
  const handleRestoreDefault = () => {
    if (
      window.confirm(
        'Bạn có chắc chắn muốn khôi phục lại bài đọc mẫu ban đầu ("The Secret of the Whispering Tree")?',
      )
    ) {
      const defaultStory = restoreDefaultStory();
      setTitle(defaultStory.title);
      setSubtitle(defaultStory.subtitle || '');
      setAuthor(defaultStory.author || 'Teacher Minh & AI Studio');
      setLevel(defaultStory.level || 'THCS / THPT (Cơ bản - Trung cấp)');
      setContentHtml(
        defaultStory.contentHtml ||
          defaultStory.paragraphs.map((p) => `<p>${p.html || p.text}</p>`).join(''),
      );
      setRequireAllKeywords(defaultStory.requireAllKeywordsBeforeCompletion ?? true);

      const restoredMap: Record<string, RequiredKeyword> = {};
      if (defaultStory.requiredKeywords) {
        defaultStory.requiredKeywords.forEach((rk) => {
          restoredMap[rk.id.toLowerCase()] = { ...rk };
        });
      }
      setRequiredKeywordMap(restoredMap);

      if (defaultStory.keywordDetails) {
        setKeywordList(Object.values(defaultStory.keywordDetails));
      } else {
        setKeywordList(
          defaultStory.keywords.map((k) => ({
            word: k,
            ipa: `/${k}/`,
            meaningVi: 'Từ khóa bài học',
          })),
        );
      }
      onUpdateStory(defaultStory);
      setSaveSuccessMsg('Đã khôi phục bài đọc mẫu thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // AI Suggest vocabulary definition
  const handleSuggestVocab = async () => {
    if (!wordInput.trim()) {
      setSuggestError('Vui lòng nhập từ tiếng Anh cần gợi ý.');
      return;
    }

    setIsSuggesting(true);
    setSuggestError(null);

    try {
      const plainSnippet = currentParagraphs.map((p) => p.text).join(' ').slice(0, 500);
      const res = await fetch('/api/suggest-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: wordInput.trim(),
          context: plainSnippet,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      const payload = data.data || data;
      if (payload.word) {
        setWordInput(payload.word);
      }
      if (payload.ipa) setIpaInput(payload.ipa);
      if (payload.meaningVi) setMeaningInput(payload.meaningVi);
      if (payload.partOfSpeech) setPartOfSpeechInput(payload.partOfSpeech);
      if (payload.example) setExampleInput(payload.example);
      if (payload.exampleVi) setExampleViInput(payload.exampleVi);
    } catch (err: any) {
      console.error('Suggest vocab error:', err);
      setSuggestError('Không thể lấy gợi ý AI. Bạn có thể nhập nghĩa thủ công.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Add or update keyword
  const handleSaveKeywordItem = () => {
    if (!wordInput.trim() || !meaningInput.trim()) {
      setSuggestError('Vui lòng nhập Từ vựng và Nghĩa tiếng Việt.');
      return;
    }

    const newKeyword: StoryKeyword = {
      word: wordInput.trim().toLowerCase(),
      ipa: ipaInput.trim() || `/${wordInput.trim().toLowerCase()}/`,
      meaningVi: meaningInput.trim(),
      partOfSpeech: partOfSpeechInput.trim(),
      example: exampleInput.trim(),
      exampleVi: exampleViInput.trim(),
    };

    let updatedList: StoryKeyword[];
    if (editingWordIndex !== null) {
      updatedList = [...keywordList];
      updatedList[editingWordIndex] = newKeyword;
      setEditingWordIndex(null);
    } else {
      const existsIndex = keywordList.findIndex(
        (k) => k.word.toLowerCase() === newKeyword.word.toLowerCase(),
      );
      if (existsIndex >= 0) {
        updatedList = [...keywordList];
        updatedList[existsIndex] = newKeyword;
      } else {
        updatedList = [...keywordList, newKeyword];
      }
    }

    setKeywordList(updatedList);

    const keywordDetailsRecord: Record<string, StoryKeyword> = {};
    updatedList.forEach((kw) => {
      keywordDetailsRecord[kw.word.toLowerCase()] = kw;
    });

    const updatedStory: Story = {
      ...story,
      keywords: updatedList.map((k) => k.word.toLowerCase()),
      keywordDetails: keywordDetailsRecord,
    };
    saveActiveStory(updatedStory);
    onUpdateStory(updatedStory);

    // Reset form
    setWordInput('');
    setIpaInput('');
    setMeaningInput('');
    setPartOfSpeechInput('');
    setExampleInput('');
    setExampleViInput('');
    setSuggestError(null);
  };

  // Remove keyword
  const handleDeleteKeyword = (index: number) => {
    const updatedList = keywordList.filter((_, i) => i !== index);
    setKeywordList(updatedList);

    const keywordDetailsRecord: Record<string, StoryKeyword> = {};
    updatedList.forEach((kw) => {
      keywordDetailsRecord[kw.word.toLowerCase()] = kw;
    });

    const updatedStory: Story = {
      ...story,
      keywords: updatedList.map((k) => k.word.toLowerCase()),
      keywordDetails: keywordDetailsRecord,
    };
    saveActiveStory(updatedStory);
    onUpdateStory(updatedStory);
  };

  // Edit keyword item
  const handleStartEditKeyword = (kw: StoryKeyword, index: number) => {
    setWordInput(kw.word);
    setIpaInput(kw.ipa || '');
    setMeaningInput(kw.meaningVi || '');
    setPartOfSpeechInput(kw.partOfSpeech || '');
    setExampleInput(kw.example || '');
    setExampleViInput(kw.exampleVi || '');
    setEditingWordIndex(index);
    setSuggestError(null);
    setSubTab('keywords');
  };

  return (
    <div id="teacher-editor-view" className="w-full max-w-4xl mx-auto pb-16">
      {/* Teacher Workspace Header */}
      <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-1.5">
              <span>Bảng điều khiển Giáo viên</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Biên tập Bài đọc & Từ khóa Trọng tâm
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Mọi từ hoặc cụm từ được <strong>IN ĐẬM</strong> trong câu chuyện sẽ tự động biến thành từ khóa bắt buộc học sinh phải học.
            </p>
          </div>

          {/* Sub-tab navigation */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start sm:self-center">
            <button
              type="button"
              id="subtab-editor"
              onClick={() => setSubTab('editor')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                subTab === 'editor'
                  ? 'bg-white text-amber-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Soạn truyện ({detectedBoldKeywords.length} từ in đậm)</span>
            </button>

            <button
              type="button"
              id="subtab-keywords"
              onClick={() => setSubTab('keywords')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                subTab === 'keywords'
                  ? 'bg-white text-amber-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Từ khóa ({detectedBoldKeywords.length || keywordList.length})</span>
            </button>

            <button
              type="button"
              id="subtab-preview"
              onClick={() => setSubTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                subTab === 'preview'
                  ? 'bg-white text-amber-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước</span>
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {saveSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* SUBTAB 1: SOẠN TRUYỆN (RICH TEXT EDITOR) */}
      {subTab === 'editor' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs p-6 space-y-5">
            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Tựa đề tiếng Anh (Title) *
                </label>
                <input
                  type="text"
                  id="input-story-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: The Secret of the Whispering Tree"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm font-semibold text-slate-800 outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Phụ đề / Tên tiếng Việt (Subtitle)
                </label>
                <input
                  type="text"
                  id="input-story-subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ví dụ: Bí mật của Cây cổ thụ biết thì thầm"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm text-slate-800 outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Tác giả / Giáo viên biên soạn
                </label>
                <input
                  type="text"
                  id="input-story-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ví dụ: Teacher Minh & AI Studio"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm text-slate-800 outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Cấp độ bài học (Target Level)
                </label>
                <input
                  type="text"
                  id="input-story-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="Ví dụ: THCS / THPT (A2 - B1)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm text-slate-800 outline-hidden transition"
                />
              </div>
            </div>

            {/* Rich Text Editor for Story Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Nội dung bài đọc tiếng Anh (Rich Text Editor) *
                </label>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <span>
                    Số từ: <strong className="text-amber-700">{liveWordCount}</strong> words
                  </span>
                  <span>•</span>
                  <span>
                    Số đoạn: <strong className="text-amber-700">{currentParagraphs.length}</strong> paragraphs
                  </span>
                  <span>•</span>
                  <span>
                    Từ in đậm: <strong className="text-amber-700">{detectedBoldKeywords.length}</strong>
                  </span>
                </div>
              </div>

              {/* Rich Story Editor with formatting and paste normalization */}
              <RichStoryEditor
                initialHtml={contentHtml}
                onChange={(newHtml) => setContentHtml(newHtml)}
              />
            </div>

            {/* 2. TEACHER KEYWORD PANEL: TỪ KHÓA BẮT BUỘC */}
            <div
              id="teacher-required-keywords-panel"
              className="bg-white rounded-2xl border border-amber-200 shadow-xs p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      TỪ KHÓA BẮT BUỘC ({detectedBoldKeywords.length})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mỗi từ/cụm từ in đậm là một từ khóa bắt buộc. Nghĩa tiếng Việt được gợi ý theo ngữ cảnh câu thực tế và có thể chỉnh sửa tự do.
                  </p>
                </div>

                {/* Teacher button: ✨ TẠO NGHĨA CHO TỪ KHÓA */}
                <button
                  type="button"
                  id="btn-generate-all-keyword-meanings"
                  onClick={handleGenerateAllMissingMeanings}
                  disabled={isGeneratingAllMeanings || detectedBoldKeywords.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold shadow-xs hover:shadow flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {isGeneratingAllMeanings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tạo nghĩa...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>✨ TẠO NGHĨA CHO TỪ KHÓA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Cards list */}
              {detectedBoldKeywords.length === 0 ? (
                <div className="text-center py-7 px-4 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-slate-500 text-xs">
                  <p className="font-semibold text-slate-700 mb-1">
                    Chưa có từ in đậm nào trong bài đọc.
                  </p>
                  <p className="text-slate-500">
                    Hãy bôi đen từ hoặc cụm từ trong trình soạn thảo rồi bấm Ctrl+B hoặc nút &ldquo;B&rdquo; để đánh dấu từ khóa bắt buộc!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {detectedBoldKeywords.map((kw) => {
                    const item = requiredKeywordMap[kw.id] || kw;
                    const meaning = item.meaningVi ?? '';
                    const isRegenerating = isRegeneratingSingle[kw.id];

                    return (
                      <div
                        key={`keyword-card-${kw.id}`}
                        id={`keyword-card-${kw.id.replace(/\s+/g, '-')}`}
                        className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 hover:border-amber-300 transition space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-slate-900 capitalize">
                                {kw.text}
                              </span>
                              {item.ipa && (
                                <span className="font-mono text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  {item.ipa}
                                </span>
                              )}
                              {item.teacherEdited ? (
                                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                                  ✓ Giáo viên đã duyệt
                                </span>
                              ) : item.meaningVi ? (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                                  ✨ Gợi ý bởi AI
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                                  Chưa có nghĩa
                                </span>
                              )}
                            </div>

                            {kw.contextSentence && (
                              <p className="text-xs text-slate-500 italic mt-1.5 line-clamp-2">
                                &ldquo;{kw.contextSentence}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* ✨ Gợi ý lại button */}
                          <button
                            type="button"
                            id={`btn-regenerate-${kw.id.replace(/\s+/g, '-')}`}
                            onClick={() => handleRegenerateSingleMeaning(kw)}
                            disabled={isRegenerating || isGeneratingAllMeanings}
                            title="Yêu cầu Gemini gợi ý lại nghĩa tiếng Việt theo ngữ cảnh câu này"
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 hover:border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-semibold shadow-2xs flex items-center gap-1 transition cursor-pointer shrink-0 disabled:opacity-60"
                          >
                            {isRegenerating ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                                <span>Đang tạo...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>Gợi ý lại</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Editable Vietnamese meaning field */}
                        <div>
                          <label
                            htmlFor={`meaning-input-${kw.id.replace(/\s+/g, '-')}`}
                            className="block text-xs font-bold text-slate-700 mb-1"
                          >
                            Nghĩa tiếng Việt:
                          </label>
                          <input
                            type="text"
                            id={`meaning-input-${kw.id.replace(/\s+/g, '-')}`}
                            value={meaning}
                            onChange={(e) => handleUpdateKeywordMeaning(kw.id, e.target.value)}
                            placeholder="Nhập nghĩa tiếng Việt (ví dụ: trách nhiệm; tinh thần trách nhiệm)..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-sm font-medium text-slate-900 bg-white outline-hidden transition"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teacher Configuration Option: Require All Keywords Before Completion */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Quy tắc hoàn thành bài đọc cho học sinh
                </p>
                <p className="text-xs text-slate-600">
                  Yêu cầu học sinh phải chạm và học tất cả các từ in đậm trước khi được bấm &ldquo;Hoàn thành bài đọc&rdquo;.
                </p>
              </div>

              <button
                type="button"
                id="btn-toggle-require-all"
                onClick={() => setRequireAllKeywords(!requireAllKeywords)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950 shadow-2xs hover:bg-amber-100 transition cursor-pointer shrink-0"
              >
                {requireAllKeywords ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>Bắt buộc (Đang bật)</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-400" />
                    <span>Không bắt buộc</span>
                  </>
                )}
              </button>
            </div>

            {/* Actions: Save & Restore */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                id="btn-restore-default-story"
                onClick={handleRestoreDefault}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục bài mẫu gốc</span>
              </button>

              <button
                type="button"
                id="btn-save-story-changes"
                onClick={handleSaveStory}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-sm hover:shadow flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu bài đọc &amp; Cập nhật</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: QUẢN LÝ TỪ KHÓA (KEYWORDS & DETECTED BOLD) */}
      {subTab === 'keywords' && (
        <div className="space-y-6">
          {/* Detected Keywords Summary Card */}
          <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <h3 className="text-sm font-bold text-amber-950">
                  Từ khóa bắt buộc từ câu chuyện ({detectedBoldKeywords.length})
                </h3>
              </div>
              <span className="text-[11px] text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md font-semibold">
                Tự động đồng bộ với chữ In đậm
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Những từ hoặc cụm từ dưới đây được giáo viên in đậm trong trình soạn thảo. Học sinh sẽ thấy chúng có nền vàng nhạt và phải học để hoàn thành bài.
            </p>

            <div className="flex flex-wrap gap-2">
              {detectedBoldKeywords.map((bk) => (
                <div
                  key={`tag-${bk.id}`}
                  className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-2xs text-xs font-bold text-amber-950"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>{bk.text}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWordInput(bk.text);
                      handleSuggestVocab();
                    }}
                    title="Gợi ý nghĩa AI cho từ này"
                    className="ml-1 text-slate-400 hover:text-amber-700 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded"
                  >
                    AI dịch
                  </button>
                </div>
              ))}
              {detectedBoldKeywords.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Chưa có từ in đậm nào. Hãy quay lại tab &ldquo;Soạn truyện&rdquo;, bôi đen từ rồi bấm nút &ldquo;In đậm&rdquo;!
                </p>
              )}
            </div>
          </div>

          {/* Keyword Addition / Edit Form Card */}
          <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingWordIndex !== null ? 'Chỉnh sửa chi tiết từ vựng' : 'Thêm / Soạn nghĩa từ vựng'}
                </h3>
                <p className="text-xs text-slate-500">
                  Bạn có thể dùng nút AI để tự động điền phiên âm IPA, nghĩa tiếng Việt và câu ví dụ.
                </p>
              </div>
              {editingWordIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingWordIndex(null);
                    setWordInput('');
                    setIpaInput('');
                    setMeaningInput('');
                    setPartOfSpeechInput('');
                    setExampleInput('');
                    setExampleViInput('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            {/* Input Row with AI Suggest button */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Từ / Cụm từ (English) *
                </label>
                <input
                  type="text"
                  id="input-keyword-word"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  placeholder="Ví dụ: responsibility, build character..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-sm font-semibold outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Phiên âm IPA
                </label>
                <input
                  type="text"
                  id="input-keyword-ipa"
                  value={ipaInput}
                  onChange={(e) => setIpaInput(e.target.value)}
                  placeholder="/rɪˌspɑːn.səˈbɪl.ə.t̬i/"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-sm font-mono outline-hidden"
                />
              </div>

              <div className="sm:col-span-5 flex items-end">
                <button
                  type="button"
                  id="btn-ai-suggest-vocab"
                  onClick={handleSuggestVocab}
                  disabled={isSuggesting || !wordInput.trim()}
                  className="w-full py-2 px-3 rounded-xl border border-amber-400 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isSuggesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" />
                      <span>Đang tra nghĩa AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>✨ GỢI Ý NGHĨA VỚI AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Meaning & Part of speech */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nghĩa tiếng Việt *
                </label>
                <input
                  type="text"
                  id="input-keyword-meaning"
                  value={meaningInput}
                  onChange={(e) => setMeaningInput(e.target.value)}
                  placeholder="Ví dụ: tinh thần trách nhiệm, sự chịu trách nhiệm"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-sm outline-hidden"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Từ loại (Part of Speech)
                </label>
                <input
                  type="text"
                  id="input-keyword-pos"
                  value={partOfSpeechInput}
                  onChange={(e) => setPartOfSpeechInput(e.target.value)}
                  placeholder="danh từ, cụm động từ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-sm outline-hidden"
                />
              </div>
            </div>

            {/* Example sentence & translation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Câu ví dụ tiếng Anh (Example)
                </label>
                <input
                  type="text"
                  id="input-keyword-example"
                  value={exampleInput}
                  onChange={(e) => setExampleInput(e.target.value)}
                  placeholder="Ví dụ: Mia learned that responsibility builds character."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-xs sm:text-sm italic outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Dịch câu ví dụ (Translation)
                </label>
                <input
                  type="text"
                  id="input-keyword-example-vi"
                  value={exampleViInput}
                  onChange={(e) => setExampleViInput(e.target.value)}
                  placeholder="Ví dụ: Mia học được rằng tinh thần trách nhiệm xây dựng nên tính cách."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-amber-500 text-xs sm:text-sm outline-hidden"
                />
              </div>
            </div>

            {suggestError && (
              <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{suggestError}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                id="btn-save-keyword-item"
                onClick={handleSaveKeywordItem}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingWordIndex !== null ? 'Cập nhật định nghĩa' : 'Lưu từ khóa vào bài đọc'}</span>
              </button>
            </div>
          </div>

          {/* List of current saved keywords */}
          <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Từ điển chi tiết của bài đọc ({keywordList.length})
              </h3>
              <span className="text-xs text-slate-500">Được ưu tiên hiển thị cao nhất khi học sinh chạm từ</span>
            </div>

            {keywordList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Chưa có từ khóa nào được lưu định nghĩa riêng.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {keywordList.map((kw, idx) => (
                  <div key={`${kw.word}-${idx}`} className="py-3 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900 capitalize">
                          {kw.word}
                        </span>
                        <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {kw.ipa}
                        </span>
                        {kw.partOfSpeech && (
                          <span className="text-xs text-slate-500 italic">
                            ({kw.partOfSpeech})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => speakEnglish(kw.word, speechRate)}
                          title="Nghe phát âm"
                          className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md transition cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs sm:text-sm font-medium text-slate-800 mt-1">
                        {kw.meaningVi}
                      </p>

                      {kw.example && (
                        <p className="text-xs text-slate-500 italic mt-0.5">
                          &ldquo;{kw.example}&rdquo; {kw.exampleVi && `— ${kw.exampleVi}`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditKeyword(kw, idx)}
                        className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeyword(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Xóa từ khóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: XEM TRƯỚC (PREVIEW) */}
      {subTab === 'preview' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Đây là giao diện tương tác thực tế mà học sinh sẽ trải nghiệm. Các từ in đậm có nền vàng nhạt bắt buộc học sinh phải học.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('editor')}
              className="text-amber-800 font-bold hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Chỉnh sửa thêm
            </button>
          </div>

          <article
            id="teacher-preview-card"
            className="bg-white rounded-2xl shadow-sm border border-amber-200/90 p-6 sm:p-10 md:p-12 relative"
          >
            {/* Story Header */}
            <header className="border-b border-amber-100 pb-6 mb-8 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-100/70 px-3 py-1 rounded-full mb-3">
                <span>{level}</span>
                <span>•</span>
                <span>{liveWordCount} words</span>
                <span>•</span>
                <span>{detectedBoldKeywords.length} từ khóa in đậm</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif text-slate-900 tracking-tight mb-2">
                {title}
              </h1>
              {subtitle && (
                <p className="text-base sm:text-lg text-slate-600 font-medium italic">
                  {subtitle}
                </p>
              )}
              {author && (
                <p className="text-xs text-slate-400 mt-2">
                  Tác giả / Biên soạn: {author}
                </p>
              )}
            </header>

            {/* Story Paragraphs */}
            <div className="story-content space-y-3 font-serif">
              {currentParagraphs.map((para) => (
                <InteractiveText
                  key={para.id}
                  paragraphId={para.id}
                  text={para.text}
                  html={para.html}
                  knownWords={knownWords}
                  learningWords={learningWords}
                  selectedWord={selectedWord}
                  speechRate={speechRate}
                  story={story}
                  onSelectWord={(info) => setSelectedWord(info)}
                />
              ))}
            </div>
          </article>

          {/* Interactive Popup inside preview */}
          {selectedWord && (
            <VocabularyPopup
              selectedWord={selectedWord}
              wordStatus="unmarked"
              speechRate={speechRate}
              isRequiredKeyword={selectedWord.isRequiredKeyword}
              onMarkKnown={() => {}}
              onMarkLearning={() => {}}
              onClose={() => setSelectedWord(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};
