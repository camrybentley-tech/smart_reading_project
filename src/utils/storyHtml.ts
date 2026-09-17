import { RequiredKeyword, StoryParagraph } from '../types';

/**
 * Normalizes pasted HTML from Microsoft Word, Google Docs, ChatGPT, and webpages.
 * Converts:
 * - <b> to <strong> (unless style="font-weight: normal / 400")
 * - <span style="font-weight: 600 / 700 / 800 / bold / bolder"> to <strong>
 * - <i> / <span style="font-style: italic"> to <em>
 * - Markdown bold **word** or **phrase** to <strong>word</strong> / <strong>phrase</strong>
 * - Strips scripts, styles, iframes, office markup, and unsafe attributes
 * - Preserves paragraphs <p>, line breaks <br>, <strong>, <em>
 */
export function normalizePastedHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) {
    return '';
  }

  // Pre-clean office comments and namespace tags
  let preCleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML and Word comments
    .replace(/<\/?o:[^>]*>/gi, '') // Remove Word <o:p> tags
    .replace(/<\/?w:[^>]*>/gi, '') // Remove Word <w:...> tags
    .replace(/<\/?m:[^>]*>/gi, ''); // Remove Word <m:...> tags

  if (typeof document === 'undefined') {
    return sanitizeWithRegex(preCleaned);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${preCleaned}</body>`, 'text/html');

    // 1. Remove dangerous / extraneous elements
    const dangerous = doc.querySelectorAll(
      'script, style, iframe, object, embed, form, input, button, svg, noscript, meta, link, applet',
    );
    dangerous.forEach((node) => node.remove());

    // 2. Handle Google Docs special wrapper: <b style="font-weight:normal">
    doc.querySelectorAll('b').forEach((bEl) => {
      const style = bEl.getAttribute('style') || '';
      const fontWeight = bEl.style.fontWeight || '';
      const isExplicitlyNormal =
        fontWeight === 'normal' ||
        fontWeight === '400' ||
        /font-weight\s*:\s*(normal|400)/i.test(style);

      if (isExplicitlyNormal) {
        // Unwrap this <b> because Google Docs uses it as a container with font-weight: normal
        const span = doc.createElement('span');
        while (bEl.firstChild) {
          span.appendChild(bEl.firstChild);
        }
        bEl.replaceWith(span);
      } else {
        // True <b> tag: normalize to <strong>
        const strong = doc.createElement('strong');
        while (bEl.firstChild) {
          strong.appendChild(bEl.firstChild);
        }
        bEl.replaceWith(strong);
      }
    });

    // 3. Normalize all elements with bold styles (span, font, em, etc.)
    const allDescendants = Array.from(doc.body.querySelectorAll('*'));
    for (const el of allDescendants) {
      if (el.tagName.toLowerCase() === 'strong' || el.tagName.toLowerCase() === 'body') {
        continue;
      }

      const style = el.getAttribute('style') || '';
      const htmlEl = el as HTMLElement;
      const fontWeight = htmlEl.style?.fontWeight || '';

      const isBold =
        fontWeight === 'bold' ||
        fontWeight === 'bolder' ||
        parseInt(fontWeight, 10) >= 600 ||
        /font-weight\s*:\s*(bold|bolder|[6-9]00)/i.test(style);

      if (isBold) {
        const strong = doc.createElement('strong');
        while (el.firstChild) {
          strong.appendChild(el.firstChild);
        }
        el.replaceWith(strong);
      }
    }

    // 4. Normalize italics <i> or font-style: italic into <em>
    doc.querySelectorAll('i').forEach((iEl) => {
      const em = doc.createElement('em');
      while (iEl.firstChild) {
        em.appendChild(iEl.firstChild);
      }
      iEl.replaceWith(em);
    });

    Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
      if (el.tagName.toLowerCase() === 'em' || el.tagName.toLowerCase() === 'body') {
        return;
      }
      const style = el.getAttribute('style') || '';
      const htmlEl = el as HTMLElement;
      const fontStyle = htmlEl.style?.fontStyle || '';
      if (fontStyle === 'italic' || /font-style\s*:\s*italic/i.test(style)) {
        const em = doc.createElement('em');
        while (el.firstChild) {
          em.appendChild(el.firstChild);
        }
        el.replaceWith(em);
      }
    });

    // 5. Convert markdown bold (**word** or **phrase**) in any text nodes
    const convertMarkdownBoldInTextNodes = (parent: Node) => {
      const childNodes = Array.from(parent.childNodes);
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (/\*\*[^\*\r\n]+?\*\*/.test(text)) {
            // Found markdown bold syntax
            const tempSpan = doc.createElement('span');
            // Safely convert **content** into <strong>content</strong>
            const escaped = escapeHtml(text).replace(
              /\*\*([^\*\r\n]+?)\*\*/g,
              '<strong>$1</strong>',
            );
            tempSpan.innerHTML = escaped;
            node.replaceWith(tempSpan);
          }
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName.toLowerCase() !== 'strong'
        ) {
          convertMarkdownBoldInTextNodes(node);
        }
      }
    };
    convertMarkdownBoldInTextNodes(doc.body);

    // 6. Serialize into clean semantic paragraphs (<p>, <br>, <strong>, <em>)
    return serializeDocToCleanHtml(doc.body);
  } catch (err) {
    console.warn('DOMParser failed in normalizePastedHtml, using fallback:', err);
    return sanitizeWithRegex(rawHtml);
  }
}

/**
 * Normalizes plain text that may contain markdown bold (**word** or **family bond**)
 * or plain newlines, converting it into clean HTML paragraphs with <strong>.
 */
export function normalizePlainTextWithMarkdown(plainText: string): string {
  if (!plainText || !plainText.trim()) return '';

  const paragraphs = plainText
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs
    .map((p) => {
      let escaped = escapeHtml(p).replace(/\n/g, '<br>');
      // Convert **bold** (words or phrases) to <strong>
      escaped = escaped.replace(/\*\*([^\*\r\n]+?)\*\*/g, '<strong>$1</strong>');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

/**
 * Universal wrapper for editor initialization or input sanitization
 */
export function normalizeAndSanitizeHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) {
    return '';
  }

  // If plain text, convert with markdown support
  if (!/<[a-z][\s\S]*>/i.test(rawHtml)) {
    return normalizePlainTextWithMarkdown(rawHtml);
  }

  return normalizePastedHtml(rawHtml);
}

/**
 * Serializes allowed elements (<p>, <br>, <strong>, <em>) and unwraps everything else.
 */
function serializeDocToCleanHtml(body: HTMLElement): string {
  const cleanBlocks: string[] = [];

  const serializeAllowed = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '');
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      let inner = '';
      el.childNodes.forEach((child) => {
        inner += serializeAllowed(child);
      });

      if (tag === 'strong' || tag === 'b') {
        return inner.trim() ? `<strong>${inner}</strong>` : '';
      }
      if (tag === 'em' || tag === 'i') {
        return inner.trim() ? `<em>${inner}</em>` : '';
      }
      if (tag === 'br') {
        return '<br>';
      }
      // Unwrap any other tag (div, span, font, a, etc.)
      return inner;
    }
    return '';
  };

  const children = Array.from(body.childNodes);
  let inlineAccumulator = '';

  const flushInline = () => {
    const trimmed = inlineAccumulator.trim();
    if (trimmed && trimmed !== '<br>') {
      cleanBlocks.push(`<p>${trimmed}</p>`);
    }
    inlineAccumulator = '';
  };

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (
        tag === 'p' ||
        tag === 'div' ||
        tag === 'h1' ||
        tag === 'h2' ||
        tag === 'h3' ||
        tag === 'h4' ||
        tag === 'h5' ||
        tag === 'h6' ||
        tag === 'blockquote' ||
        tag === 'li'
      ) {
        flushInline();
        let pContent = '';
        el.childNodes.forEach((c) => {
          pContent += serializeAllowed(c);
        });
        const trimmed = pContent.trim();
        if (trimmed && trimmed !== '<br>') {
          cleanBlocks.push(`<p>${trimmed}</p>`);
        }
      } else {
        inlineAccumulator += serializeAllowed(child);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      inlineAccumulator += escapeHtml(child.textContent || '');
    }
  }
  flushInline();

  if (cleanBlocks.length === 0) {
    return '';
  }

  return cleanBlocks.join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeWithRegex(html: string): string {
  let cleaned = html
    .replace(/<b(\s+[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s+[^>]*)?>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>');

  cleaned = cleaned.replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(['"]).*?\1/gi, '');
  cleaned = cleaned.replace(/\*\*([^\*\r\n]+?)\*\*/g, '<strong>$1</strong>');

  return cleaned;
}

/**
 * Extracts clean required keywords from bold tags (<strong>...</strong>)
 * Handles phrases (e.g. "take responsibility", "family bond"), punctuation stripping,
 * exact context sentence extraction, and case-insensitive deduplication.
 */
export function extractRequiredKeywordsFromHtml(
  html: string,
  existingKeywords?: RequiredKeyword[],
): RequiredKeyword[] {
  if (!html) return [];

  const existingMap = new Map<string, RequiredKeyword>();
  if (existingKeywords) {
    for (const ek of existingKeywords) {
      if (ek && ek.id) {
        existingMap.set(ek.id.toLowerCase(), ek);
      }
    }
  }

  // Pre-parse paragraphs and collect sentences to find contextual sentences
  const paragraphs = parseStoryHtmlToParagraphs(html);
  const allSentences: string[] = [];
  for (const p of paragraphs) {
    const sents = p.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    allSentences.push(...sents);
  }

  const map = new Map<string, RequiredKeyword>();

  // Matches <strong>...</strong> or <b>...</b>
  const regex = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const rawContent = match[1];
    // Strip any nested tags if any
    const textOnly = rawContent.replace(/<[^>]*>/g, '').trim();

    // Clean leading and trailing punctuation (quotes, periods, commas) but keep apostrophes/hyphens inside
    const cleaned = textOnly
      .replace(/^[\s"'“”‘’.,;:!?()\[\]{}]+/, '')
      .replace(/[\s"'“”‘’.,;:!?()\[\]{}]+$/, '')
      .trim();

    if (!cleaned) continue;

    const normalizedId = cleaned.toLowerCase();

    if (!map.has(normalizedId)) {
      const existing = existingMap.get(normalizedId);

      // Find sentence matching keyword
      const matchedSentence =
        allSentences.find((s) => {
          const lowerS = s.toLowerCase();
          // Regex with word boundaries for single words or substring for phrases
          const escaped = normalizedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerS) || lowerS.includes(normalizedId);
        }) || (paragraphs[0]?.text || '');

      map.set(normalizedId, {
        id: normalizedId,
        text: cleaned,
        required: true,
        meaningVi: existing?.meaningVi || '',
        meaningSource: existing?.meaningSource || 'ai',
        teacherEdited: existing?.teacherEdited ?? false,
        ipa: existing?.ipa || '',
        example: matchedSentence || existing?.example || '',
        exampleVi: existing?.exampleVi || '',
        partOfSpeech: existing?.partOfSpeech || '',
        contextSentence: matchedSentence || existing?.contextSentence || '',
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Parses sanitized story HTML into StoryParagraphs with both plain text and paragraph HTML
 */
export function parseStoryHtmlToParagraphs(html: string): StoryParagraph[] {
  if (!html || !html.trim()) {
    return [];
  }

  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs: StoryParagraph[] = [];
  let match: RegExpExecArray | null;
  let idx = 1;

  while ((match = pRegex.exec(html)) !== null) {
    const pInnerHtml = match[1].trim();
    if (!pInnerHtml || pInnerHtml === '<br>') continue;

    // Plain text stripped of tags for voice reading / word count
    const plainText = pInnerHtml
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();

    if (plainText) {
      paragraphs.push({
        id: `p${idx++}`,
        text: plainText,
        html: pInnerHtml,
      });
    }
  }

  // Fallback if no <p> tags matched
  if (paragraphs.length === 0) {
    const plainText = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (plainText) {
      paragraphs.push({
        id: 'p1',
        text: plainText,
        html: html,
      });
    }
  }

  return paragraphs;
}

/**
 * Parses a paragraph's inner HTML into structured segments for interactive rendering.
 * Segments are either:
 * - { type: 'bold', rawText: string, cleaned: string, keywordId: string }
 * - { type: 'text', content: string }
 */
export type ParagraphSegment =
  | {
      type: 'bold';
      rawText: string;
      cleaned: string;
      keywordId: string;
    }
  | {
      type: 'text';
      content: string;
    };

export function parseParagraphSegments(paraHtml: string): ParagraphSegment[] {
  if (!paraHtml) return [];

  const segments: ParagraphSegment[] = [];
  // Match <strong>...</strong> (or <b>)
  const regex = /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(paraHtml)) !== null) {
    const textBefore = paraHtml.substring(lastIndex, match.index);
    if (textBefore) {
      segments.push({
        type: 'text',
        content: decodeHtmlEntities(textBefore.replace(/<[^>]*>/g, '')),
      });
    }

    const boldContent = match[1].replace(/<[^>]*>/g, '').trim();
    const cleaned = decodeHtmlEntities(boldContent)
      .replace(/^[\s"'“”‘’.,;:!?()\[\]{}]+/, '')
      .replace(/[\s"'“”‘’.,;:!?()\[\]{}]+$/, '')
      .trim();

    if (cleaned) {
      segments.push({
        type: 'bold',
        rawText: decodeHtmlEntities(boldContent),
        cleaned,
        keywordId: cleaned.toLowerCase(),
      });
    } else if (boldContent) {
      segments.push({
        type: 'text',
        content: decodeHtmlEntities(boldContent),
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const textAfter = paraHtml.substring(lastIndex);
  if (textAfter) {
    segments.push({
      type: 'text',
      content: decodeHtmlEntities(textAfter.replace(/<[^>]*>/g, '')),
    });
  }

  return segments;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
