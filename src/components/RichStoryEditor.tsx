import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Undo,
  Redo,
  Sparkles,
  HelpCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import {
  normalizePastedHtml,
  normalizePlainTextWithMarkdown,
  extractRequiredKeywordsFromHtml,
} from '../utils/storyHtml';

interface RichStoryEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
  onKeywordsDetected?: (keywords: Array<{ id: string; text: string }>) => void;
}

export const RichStoryEditor: React.FC<RichStoryEditorProps> = ({
  initialHtml,
  onChange,
  onKeywordsDetected,
}) => {
  const [detectedKeywords, setDetectedKeywords] = useState<
    Array<{ id: string; text: string }>
  >([]);

  const editorInstanceRef = useRef<Editor | null>(null);
  const lastExternalHtmlRef = useRef<string>(initialHtml);

  // Synchronize detected keywords
  const updateDetectedKeywords = useCallback(
    (html: string) => {
      const kws = extractRequiredKeywordsFromHtml(html);
      setDetectedKeywords(kws);
      if (onKeywordsDetected) {
        onKeywordsDetected(kws);
      }
    },
    [onKeywordsDetected],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        bold: {
          HTMLAttributes: {
            class: 'font-bold text-slate-950',
          },
        },
      }),
    ],
    content: initialHtml || '<p></p>',
    editorProps: {
      attributes: {
        id: 'tiptap-story-editor-content',
        class:
          'tiptap p-4 sm:p-5 min-h-[260px] max-h-[520px] overflow-y-auto font-serif text-base sm:text-lg leading-relaxed text-slate-800 outline-hidden focus:outline-hidden selection:bg-amber-200 selection:text-slate-950',
      },
      // Transform any pasted HTML (from Word, Google Docs, ChatGPT, Web) to clean normalized <strong>
      transformPastedHTML(html) {
        return normalizePastedHtml(html);
      },
      // Robust clipboard paste interceptor ensuring bold formatting is never lost
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const html = clipboardData.getData('text/html');
        const plainText = clipboardData.getData('text/plain');

        const ed = editorInstanceRef.current;
        if (!ed) return false;

        // 1. If HTML is available, sanitize and insert HTML while preserving all bold variants
        if (html && html.trim()) {
          const cleanHtml = normalizePastedHtml(html);
          if (cleanHtml && cleanHtml.trim()) {
            ed.commands.insertContent(cleanHtml);
            const currentHtml = ed.getHTML();
            onChange(currentHtml);
            updateDetectedKeywords(currentHtml);
            return true;
          }
        }

        // 2. Fallback: only use text/plain when no HTML exists or HTML was blank
        if (plainText && plainText.trim()) {
          const cleanHtml = normalizePlainTextWithMarkdown(plainText);
          if (cleanHtml && cleanHtml.trim()) {
            ed.commands.insertContent(cleanHtml);
            const currentHtml = ed.getHTML();
            onChange(currentHtml);
            updateDetectedKeywords(currentHtml);
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const currentHtml = ed.getHTML();
      onChange(currentHtml);
      updateDetectedKeywords(currentHtml);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      updateDetectedKeywords(ed.getHTML());
    },
  });

  // Keep ref up to date
  useEffect(() => {
    editorInstanceRef.current = editor;
  }, [editor]);

  // Keep editor content in sync when initialHtml changes from external actions (e.g. Restore Default)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (initialHtml !== lastExternalHtmlRef.current) {
      lastExternalHtmlRef.current = initialHtml;
      const currentHtml = editor.getHTML();
      if (initialHtml !== currentHtml) {
        editor.commands.setContent(initialHtml || '<p></p>', { emitUpdate: false });
        updateDetectedKeywords(initialHtml);
      }
    }
  }, [initialHtml, editor, updateDetectedKeywords]);

  // Initial detection when editor mounts
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      updateDetectedKeywords(editor.getHTML());
    }
  }, [editor, updateDetectedKeywords]);

  if (!editor) {
    return null;
  }

  const isBoldActive = editor.isActive('bold');
  const isItalicActive = editor.isActive('italic');

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200 transition">
      {/* TipTap Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 select-none">
        <div className="flex items-center gap-1">
          {/* Bold Button */}
          <button
            type="button"
            id="toolbar-btn-bold"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            title="In đậm (Từ khóa bắt buộc) - Ctrl+B"
            className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isBoldActive
                ? 'bg-amber-300 text-slate-950 ring-1 ring-amber-400 font-black'
                : 'text-slate-700 hover:bg-slate-200 hover:text-slate-950 active:bg-amber-100'
            }`}
          >
            <Bold className="w-4 h-4 stroke-[2.8]" />
            <span>In đậm (Từ khóa)</span>
          </button>

          {/* Italic Button */}
          <button
            type="button"
            id="toolbar-btn-italic"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            title="In nghiêng - Ctrl+I"
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
              isItalicActive
                ? 'bg-slate-200 text-slate-950 font-bold'
                : 'text-slate-700 hover:bg-slate-200 hover:text-slate-950'
            }`}
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* Undo */}
          <button
            type="button"
            id="toolbar-btn-undo"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().undo().run();
            }}
            disabled={!editor.can().undo()}
            title="Hoàn tác (Undo) - Ctrl+Z"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            type="button"
            id="toolbar-btn-redo"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().redo().run();
            }}
            disabled={!editor.can().redo()}
            title="Làm lại (Redo) - Ctrl+Y"
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Detected Keywords Status Pill in Toolbar */}
        <div className="flex items-center gap-2">
          <div
            id="detected-keywords-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
              detectedKeywords.length > 0
                ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs'
                : 'bg-slate-200/80 text-slate-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              Từ khóa in đậm được phát hiện: {detectedKeywords.length}
            </span>
          </div>
        </div>
      </div>

      {/* TipTap Editor Surface */}
      <EditorContent editor={editor} />

      {/* LIVE CHECK IN TEACHER MODE (Requirement #10) */}
      <div
        id="live-keyword-detector-box"
        className="p-3.5 bg-amber-50/70 border-t border-amber-200/80 text-xs text-slate-700 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-950">
            <Tag className="w-3.5 h-3.5 text-amber-700" />
            <span>
              Từ khóa in đậm được phát hiện: {detectedKeywords.length}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Tự động cập nhật ngay khi dán văn bản hoặc bấm In đậm
          </span>
        </div>

        {/* Display detected words as small chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {detectedKeywords.length > 0 ? (
            detectedKeywords.map((kw) => (
              <span
                key={`live-chip-${kw.id}`}
                id={`live-chip-${kw.id.replace(/\s+/g, '-')}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-950 font-bold text-xs shadow-2xs animate-in fade-in"
              >
                <span>{kw.text}</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
              </span>
            ))
          ) : (
            <span className="text-slate-400 italic text-[11px]">
              Chưa có từ in đậm nào. Bôi đen từ/cụm từ rồi bấm &ldquo;In đậm (Từ khóa)&rdquo; hoặc dán văn bản từ Word/Docs/ChatGPT!
            </span>
          )}
        </div>
      </div>

      {/* Editor Footer Help */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            Hỗ trợ dán trực tiếp từ <strong>Word</strong>, <strong>Google Docs</strong>, <strong>ChatGPT</strong> (kể cả cú pháp **từ khóa**).
          </span>
        </div>
      </div>
    </div>
  );
};
