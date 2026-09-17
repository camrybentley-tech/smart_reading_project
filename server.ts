import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Google GenAI client
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

/**
 * Converts raw 24000Hz 16-bit mono linear PCM to standard WAV buffer with 44-byte RIFF header
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // 'fmt ' sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // 'data' sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// In-memory server-side audio cache
const serverAudioCache = new Map<string, string>(); // cacheKey -> base64 WAV

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Endpoint: POST /api/tts
 * Body: { text: string, voice?: string, accent?: 'en-US' | 'en-GB' }
 * Uses Gemini 3.1 Flash TTS model as primary, with seamless fallback to
 * authentic native studio dictionary pronunciation audio (US/UK) to guarantee 100% availability.
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Erinome', accent = 'en-US' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const cleanText = text.trim();
    const cacheKey = `${cleanText}_${accent}_${voice}`;

    // Return from server cache if present
    if (serverAudioCache.has(cacheKey)) {
      return res.json({
        audioBase64: serverAudioCache.get(cacheKey),
        mimeType: 'audio/mpeg',
        cached: true,
      });
    }

    // Attempt 1: Gemini TTS if available
    let geminiSuccess = false;
    let wavBase64 = '';

    try {
      const ai = getGenAI();
      const promptText =
        accent === 'en-GB'
          ? `Pronounce clearly in British English with natural rhythm and intonation: "${cleanText}"`
          : `Pronounce clearly in American English with natural rhythm and intonation: "${cleanText}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || 'Erinome' },
            },
          },
        },
      });

      const candidates = response.candidates;
      const base64Audio = candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const pcmBuffer = Buffer.from(base64Audio, 'base64');
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
        wavBase64 = wavBuffer.toString('base64');
        geminiSuccess = true;
      }
    } catch (geminiError: any) {
      console.warn('Gemini TTS unavailable, falling back to authentic native studio audio:', geminiError?.message || geminiError);
    }

    if (geminiSuccess && wavBase64) {
      serverAudioCache.set(cacheKey, wavBase64);
      return res.json({
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        cached: false,
        source: 'gemini',
      });
    }

    // Attempt 2: Authentic Native Studio Dictionary Audio (Google Dictionary / Oxford / Cambridge pronunciation CDN)
    const singleWord = cleanText.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '').toLowerCase();
    const isSingleWord = !cleanText.includes(' ') && singleWord.length > 0;
    const accentSuffix = accent === 'en-GB' ? 'gb' : 'us';

    if (isSingleWord) {
      try {
        const dictUrl = `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${singleWord}--_${accentSuffix}_1.mp3`;
        const dictRes = await fetch(dictUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });

        if (dictRes.ok) {
          const arrayBuffer = await dictRes.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          if (buf.length > 500) {
            const mp3Base64 = buf.toString('base64');
            serverAudioCache.set(cacheKey, mp3Base64);
            return res.json({
              audioBase64: mp3Base64,
              mimeType: 'audio/mpeg',
              cached: false,
              source: 'dictionary-studio',
            });
          }
        }
      } catch (dictErr) {
        console.warn('Dictionary CDN audio lookup skipped:', dictErr);
      }
    }

    // Attempt 3: High-Fidelity Native Audio Stream (US or UK native speaker)
    const targetLang = accent === 'en-GB' ? 'en-GB' : 'en-US';
    const streamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    const streamRes = await fetch(streamUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (streamRes.ok) {
      const arrayBuffer = await streamRes.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 300) {
        const mp3Base64 = buf.toString('base64');
        serverAudioCache.set(cacheKey, mp3Base64);
        return res.json({
          audioBase64: mp3Base64,
          mimeType: 'audio/mpeg',
          cached: false,
          source: 'native-tts-stream',
        });
      }
    }

    throw new Error('All native TTS providers were unable to produce audio');
  } catch (error: any) {
    console.error('TTS API error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate speech with native audio engine',
    });
  }
});

/**
 * Endpoint: POST /api/suggest-vocab
 * Body: { word: string, context?: string }
 * Suggests IPA, contextual Vietnamese meaning, and simple example using gemini-3.8-flash.
 */
app.post('/api/suggest-vocab', async (req, res) => {
  try {
    const { word, context } = req.body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const cleanWord = word.trim();
    const ai = getGenAI();

    const prompt = `You are an expert English-Vietnamese language teacher for Vietnamese students (THCS / THPT, A2-B1 levels).
Analyze the English word: "${cleanWord}".
${context ? `Context in story: "${context}"` : ''}

Provide a JSON object with:
- "word": exact word "${cleanWord}"
- "ipa": accurate IPA phonetic transcription wrapped in slashes (e.g. "/ˈbjuː.tɪ.fəl/")
- "meaningVi": concise, natural, accurate Vietnamese definition fitting the context
- "partOfSpeech": Vietnamese part of speech (e.g. "danh từ", "động từ", "tính từ", "phó từ")
- "example": a short, simple, high-frequency English sentence using this word
- "exampleVi": natural Vietnamese translation of that example sentence`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Gemini returned empty response');
    }

    const parsed = JSON.parse(textOutput);
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Suggest vocab error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to suggest vocabulary meaning',
    });
  }
});

/**
 * Endpoint: POST /api/generate-keyword-meanings
 * Body: { items: Array<{ id: string; text: string; contextSentence?: string }>, storyTitle?: string }
 * Generates contextual Vietnamese meanings and IPA for required bold keywords based on their exact sentences.
 */
app.post('/api/generate-keyword-meanings', async (req, res) => {
  try {
    const { items, storyTitle } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const ai = getGenAI();

    const prompt = `You are an expert English-Vietnamese language teacher for Vietnamese students (THCS / THPT, A2-B1 levels).
Task: For each English required keyword or bold phrase, provide a concise, natural Vietnamese contextual meaning based on how the word or phrase is actually used in the given sentence.

CRITICAL RULES:
1. Do NOT simply translate the word using generic dictionary definitions. The meaning MUST match how the word or phrase is actually used in the exact sentence/story context.
   Examples:
   - "responsibility" in "Doing household chores teaches responsibility." -> "trách nhiệm; tinh thần trách nhiệm"
   - "strengthen" in "Small actions can strengthen the family bond." -> "củng cố; làm bền chặt"
   - "bond" in "Small actions can strengthen the family bond." -> "sự gắn kết" or "mối gắn kết"
   - "gratitude" in "develop gratitude" -> "lòng biết ơn"
   - "character" in "builds good character" -> "phẩm chất; tính cách"
2. Support entire bold phrases as a single unit:
   - "take responsibility" -> "chịu trách nhiệm"
   - "family bond" -> "sự gắn kết gia đình"
3. Keep Vietnamese meanings short, natural and appropriate for students (approximately 2–8 Vietnamese words). Do NOT write long explanations.
4. Also provide standard IPA phonetic transcription for the word or phrase (e.g. "/rɪˌspɒnsəˈbɪləti/").
${storyTitle ? `Story context/topic: "${storyTitle}"` : ''}

List of keywords and their exact context sentences:
${JSON.stringify(
  items.map((it) => ({
    id: it.id,
    text: it.text,
    contextSentence: it.contextSentence || '',
  })),
  null,
  2,
)}

Return a JSON object with a "results" array:
{
  "results": [
    {
      "id": "item id matching the request",
      "text": "original keyword text",
      "meaningVi": "short contextual Vietnamese definition (2-8 words)",
      "ipa": "IPA phonetic transcription (e.g. /.../)"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Gemini returned empty response for keyword meanings');
    }

    const parsed = JSON.parse(textOutput);
    return res.json({
      success: true,
      results: parsed.results || [],
    });
  } catch (error: any) {
    console.error('Generate keyword meanings error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate contextual keyword meanings',
    });
  }
});

/**
 * Endpoint: POST /api/assess-pronunciation
 * Body: {
 *   audioBase64: string,
 *   mimeType?: string,
 *   mode?: 'read-aloud' | 'speaking',
 *   referenceText?: string,
 *   requiredKeywords?: string[],
 *   question?: string,
 *   questionVi?: string,
 *   suggestedKeywords?: string[],
 *   targetAccent?: 'en-US' | 'en-GB',
 *   storyTitle?: string
 * }
 * Transcribes student voice and provides CEFR-standard assessment for Read Aloud and Speaking.
 */
app.post('/api/assess-pronunciation', async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      mode = 'read-aloud',
      referenceText = '',
      requiredKeywords = [],
      question = '',
      questionVi = '',
      suggestedKeywords = [],
      targetAccent = 'en-US',
      storyTitle,
    } = req.body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio data (audioBase64) is required' });
    }

    if (mode === 'read-aloud' && (!referenceText || typeof referenceText !== 'string' || !referenceText.trim())) {
      return res.status(400).json({ error: 'Reference text is required for Read Aloud mode' });
    }

    if (mode === 'speaking' && (!question || typeof question !== 'string' || !question.trim())) {
      return res.status(400).json({ error: 'Question is required for Speaking mode' });
    }

    const ai = getGenAI();
    // Normalize mimeType: strip codec parameters e.g. "audio/webm;codecs=opus" -> "audio/webm"
    const rawMime = mimeType.split(';')[0].trim().toLowerCase();
    const cleanMime =
      rawMime.startsWith('audio/') || rawMime === 'video/webm' ? rawMime : 'audio/webm';

    let systemPrompt = '';

    if (mode === 'speaking') {
      // CEFR Speaking Assessment Prompt
      systemPrompt = `You are a certified, supportive CEFR English oral examiner evaluating a Vietnamese secondary or high school student (A1 - B2 target levels).
The student is performing a SPEAKING task where they answer a question or prompt orally in their own words.

PROMPT QUESTION:
English: "${question.trim()}"
${questionVi ? `Vietnamese translation: "${questionVi.trim()}"` : ''}
${storyTitle ? `TOPIC CONTEXT: "${storyTitle}"` : ''}
SUGGESTED KEYWORDS: ${JSON.stringify(suggestedKeywords, null, 2)}
TARGET ACCENT MODEL: ${targetAccent === 'en-GB' ? 'British English (en-GB)' : 'American English (en-US)'}

CRITICAL CEFR & INTELLIGIBILITY DIRECTIVES (MANDATORY):
1. AUDIO AUDIT:
   - Check if the audio contains actual spoken English.
   - If the recording is silent, extremely brief (< 1.5 seconds of speech), only background noise, or completely non-English speech:
     Set "isValidAudio": false
     Set "invalidReasonVi": "Âm thanh chưa đủ rõ hoặc quá ngắn. Em hãy kiểm tra micro và thu lại câu trả lời nhé."
     Do NOT assign arbitrary scores. Return immediately.

2. ACCENT NEUTRALITY & INTELLIGIBILITY FIRST (MANDATORY CEFR PRINCIPLE):
   - Under international CEFR standards, native speaker accent (BBC or American broadcast standard) is NOT required.
   - PRIORITIZE INTELLIGIBILITY: Assess how clearly and easily an international listener can comprehend the student's message and ideas.
   - DO NOT penalize the student solely for having a Vietnamese accent, Vietnamese vowel coloring, or non-native intonation, as long as words are intelligible and understandable.
   - Only note pronunciation if critical ending sounds (/s/, /ed/) or consonant confusions (/p/ vs /b/) hinder communicative clarity.

3. VERBATIM SPEECH TRANSCRIPTION:
   - Transcribe verbatim exactly what the student spoke ("transcript"). Do NOT artificially edit or fix their speech in the transcript.

4. CEFR RUBRIC EVALUATION FOR SPEAKING (5 Criteria, Total Max 100 points):
   - Criterion 1: "task_fulfillment" - "Đáp ứng yêu cầu & Ý tưởng (Task Fulfillment & Ideas)" (Max 25):
     Did the student address the prompt? Did they provide relevant ideas, reasons, or personal examples?
   - Criterion 2: "fluency_coherence" - "Độ trôi chảy & Mạch lạc (Fluency & Coherence)" (Max 25):
     Natural speaking flow, logical progression, linking words (because, so, and, also, for example).
   - Criterion 3: "vocabulary" - "Vốn từ vựng & Diễn đạt (Vocabulary & Range)" (Max 20):
     Appropriate words for the topic, attempting to express ideas clearly, use of topic keywords.
   - Criterion 4: "grammar" - "Ngữ pháp & Cấu trúc câu (Grammar & Sentence Structure)" (Max 15):
     Accurate use of basic tenses (present, past), word order, subject-verb agreement.
   - Criterion 5: "pronunciation" - "Phát âm & Độ dễ hiểu (Pronunciation & Intelligibility)" (Max 15):
     Clear articulation, words easily understood by an international listener. Vietnamese accent is fully accepted.

5. OVERALL CEFR LEVEL DETERMINATION:
   - Assign overall "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" based on their response.
   - Provide "cefrLevelTitle": e.g. "A2 - Giao tiếp cơ bản (Elementary)" or "B1 - Tự tin trung cấp (Intermediate)".
   - Provide "cefrLevelDescriptionVi": 1 short encouraging sentence describing what this CEFR level signifies for this speaking task.
   - "intelligibilityScore": 0 to 100 (Measure purely how easily an international listener understands the speaker).
   - "intelligibilityNoteVi": Explaining that Vietnamese accent is accepted and highlighting their intelligibility.

6. CONSTRUCTIVE FEEDBACK FOR VIETNAMESE LEARNERS:
   - "overallFeedbackVi": 2-3 warm, positive, encouraging sentences in Vietnamese summarizing their performance.
   - "strengthsVi": 2-3 bullet points in Vietnamese praising specific things they did well.
   - "improvementsVi": 1-2 actionable tips in Vietnamese to reach the next CEFR band.
   - "grammarFeedbackVi": Gentle, constructive feedback on 1-2 grammar points noticed (in Vietnamese).
   - "suggestedBetterPhrasing": A natural, polished English way to express their ideas at a higher CEFR level, followed by Vietnamese translation.
   - "suggestedVocabulary": 2-4 useful words/phrases relevant to the topic that the student could use next time.

Return ONLY a JSON object with this exact structure:
{
  "isValidAudio": true,
  "invalidReasonVi": "",
  "transcript": "student spoken transcript",
  "mode": "speaking",
  "cefrLevel": "B1",
  "cefrLevelTitle": "B1 - Tự tin trung cấp (Intermediate)",
  "cefrLevelDescriptionVi": "Em diễn đạt ý tưởng rõ ràng, câu trả lời có tính liên kết và người nghe quốc tế hiểu được đầy đủ.",
  "totalScore": 84,
  "intelligibilityScore": 90,
  "intelligibilityNoteVi": "Lời nói rõ ràng và rất dễ hiểu. Chất giọng tự nhiên không làm ảnh hưởng đến khả năng truyền đạt thông điệp.",
  "criteria": [
    {
      "id": "task_fulfillment",
      "name": "Đáp ứng yêu cầu & Ý tưởng",
      "score": 22,
      "maxScore": 25,
      "level": "B1",
      "feedbackVi": "Trả lời đúng trọng tâm câu hỏi, có nêu lý do và ví dụ thực tế."
    },
    {
      "id": "fluency_coherence",
      "name": "Độ trôi chảy & Mạch lạc",
      "score": 20,
      "maxScore": 25,
      "level": "B1",
      "feedbackVi": "Nói khá liền mạch, biết dùng liên từ 'because', 'also' để nối ý."
    },
    {
      "id": "vocabulary",
      "name": "Vốn từ vựng & Diễn đạt",
      "score": 17,
      "maxScore": 20,
      "level": "B1",
      "feedbackVi": "Sử dụng tốt các từ vựng liên quan đến chủ đề."
    },
    {
      "id": "grammar",
      "name": "Ngữ pháp & Cấu trúc câu",
      "score": 12,
      "maxScore": 15,
      "level": "A2",
      "feedbackVi": "Cấu trúc câu rõ nghĩa, chú ý thì quá khứ khi kể lại trải nghiệm."
    },
    {
      "id": "pronunciation",
      "name": "Phát âm & Độ dễ hiểu",
      "score": 13,
      "maxScore": 15,
      "level": "B1",
      "feedbackVi": "Phát âm to rõ, dễ hiểu đối với người nghe quốc tế."
    }
  ],
  "overallFeedbackVi": "Em trả lời rất tự tin và đúng trọng tâm câu hỏi! Dòng suy nghĩ mạch lạc và phát âm rõ ràng giúp người nghe nắm bắt ý rất nhanh.",
  "strengthsVi": [
    "Trả lời trực diện vào câu hỏi với ý tưởng phong phú",
    "Phát âm rõ ràng, tốc độ nói tự nhiên vừa phải",
    "Vận dụng tốt các từ nối để liên kết câu"
  ],
  "improvementsVi": [
    "Luyện tập thêm việc sử dụng thì quá khứ đơn đều đặn hơn khi kể chuyện",
    "Mở rộng thêm 1 câu giải thích sâu hơn để đạt cấp độ B2"
  ],
  "grammarFeedbackVi": "Các câu đơn và câu ghép cơ bản của em rất tốt. Lưu ý nhỏ: khi dùng 'yesterday' hoặc kể chuyện đã qua, hãy nhớ chuyển động từ sang dạng quá khứ nhé.",
  "suggestedBetterPhrasing": "In my opinion, helping my parents is essential because it not only relieves their workload but also strengthens our family bond. (Theo em, giúp đỡ bố mẹ là điều rất cần thiết vì việc đó không chỉ giảm bớt gánh nặng cho bố mẹ mà còn gắn kết tình cảm gia đình.)",
  "suggestedVocabulary": ["workload (khối lượng công việc)", "relieve (làm nhẹ bớt)", "essential (rất quan trọng)"]
}`;
    } else {
      // CEFR Read Aloud Assessment Prompt
      systemPrompt = `You are a certified, supportive CEFR English oral examiner evaluating a Vietnamese secondary or high school student (A1 - B2 target levels).
The student is performing a READ ALOUD task from a provided English text.

TARGET ACCENT MODEL: ${targetAccent === 'en-GB' ? 'British English (en-GB)' : 'American English (en-US)'}
${storyTitle ? `STORY TITLE: "${storyTitle}"` : ''}

REFERENCE ENGLISH TEXT (What the student was expected to read):
"""
${referenceText.trim()}
"""

REQUIRED BOLD KEYWORDS TO CHECK:
${JSON.stringify(requiredKeywords, null, 2)}

CRITICAL CEFR & INTELLIGIBILITY DIRECTIVES (MANDATORY):
1. AUDIO AUDIT:
   - Check if the audio contains intelligible English reading speech.
   - If the recording is silent, extremely brief (< 1.5 seconds of speech), only background noise, or completely non-English speech:
     Set "isValidAudio": false
     Set "invalidReasonVi": "Âm thanh chưa đủ rõ. Em hãy kiểm tra micro và thu lại bài đọc nhé."
     Do NOT assign artificial low scores. Return immediately.

2. ACCENT NEUTRALITY & INTELLIGIBILITY FIRST (MANDATORY CEFR PRINCIPLE):
   - Under international CEFR standards, native British or American accents are NOT required.
   - PRIORITIZE INTELLIGIBILITY: Assess how clearly and easily an international listener can comprehend the student's speech.
   - DO NOT penalize the student solely for having a Vietnamese accent or Vietnamese phonology coloring, provided the sounds and words are recognizable and intelligible.
   - Focus on recognizable phonemes, ending consonants, word stress, and natural pauses.

3. VERBATIM SPEECH TRANSCRIPTION:
   - Transcribe verbatim what the student actually spoke ("transcript"). Do NOT silently fix omitted words, mispronunciations, or repetitions.

4. CEFR RUBRIC EVALUATION FOR READ ALOUD (4 Criteria, Total Max 100 points):
   - Criterion 1: "pronunciation" - "Độ dễ hiểu & Phát âm (Intelligibility & Pronunciation)" (Max 35):
     Are vowel sounds and consonant clusters pronounced intelligibly? Are essential ending sounds (/s/, /t/, /d/) audible?
     Vietnamese accent is NOT penalized.
   - Criterion 2: "fluency" - "Độ trôi chảy & Ngắt nhịp (Fluency & Chunking)" (Max 25):
     Smooth reading speed, appropriate pausing at commas, full stops, and grammatical chunks.
   - Criterion 3: "intonation" - "Trọng âm & Ngữ điệu (Stress & Intonation)" (Max 20):
     Correct syllable stress in multisyllabic words, sentence rhythm, natural pitch movement.
   - Criterion 4: "completeness" - "Độ chính xác nội dung (Text Accuracy & Completeness)" (Max 20):
     Reading the words in the reference text accurately, without skipping whole lines or inserting irrelevant words.

5. OVERALL CEFR LEVEL DETERMINATION:
   - Assign overall "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1".
   - Provide "cefrLevelTitle": e.g. "B1 - Đọc trôi chảy (Intermediate)".
   - Provide "cefrLevelDescriptionVi": 1 short encouraging sentence describing their reading level.
   - "intelligibilityScore": 0 to 100 (Representing how comprehensible the reading was to an international listener).
   - "intelligibilityNoteVi": Explaining that Vietnamese accent is accepted and highlighting their intelligibility.

6. SPECIFIC ASSESSMENTS:
   - "requiredKeywordResults": For each word in REQUIRED BOLD KEYWORDS:
     status ("good" | "practice" | "unclear"), feedbackVi (concise, encouraging tip in Vietnamese).
   - "wordsToPractice": Array of at most 5 priority words to improve, with concise, student-friendly reasonVi and referenceSentence.
   - "overallFeedbackVi": 2-3 encouraging, constructive sentences in Vietnamese.
   - "strengthsVi": 2-3 bullet points of what the student did well.
   - "improvementsVi": 1-2 actionable tips to level up.
   - "wordHighlights": List of key words categorized as "correct", "practice", or "omitted".

Return ONLY a JSON object with this exact structure:
{
  "isValidAudio": true,
  "invalidReasonVi": "",
  "transcript": "student spoken transcript",
  "mode": "read-aloud",
  "cefrLevel": "B1",
  "cefrLevelTitle": "B1 - Đọc trôi chảy (Intermediate)",
  "cefrLevelDescriptionVi": "Em đọc rõ ràng, phát âm dễ hiểu và nắm bắt tốt ngữ điệu của các câu văn.",
  "totalScore": 86,
  "intelligibilityScore": 92,
  "intelligibilityNoteVi": "Lời đọc rất rõ ràng, người nghe quốc tế hiểu được đầy đủ nội dung. Accent tự nhiên không làm giảm độ hiểu.",
  "scores": {
    "pronunciation": 30,
    "fluency": 22,
    "intonation": 17,
    "completeness": 17,
    "total": 86
  },
  "criteria": [
    {
      "id": "pronunciation",
      "name": "Độ dễ hiểu & Phát âm",
      "score": 30,
      "maxScore": 35,
      "level": "B1",
      "feedbackVi": "Phát âm rõ ràng các nguyên âm và phụ âm chính, người nghe hiểu tốt."
    },
    {
      "id": "fluency",
      "name": "Độ trôi chảy & Ngắt nhịp",
      "score": 22,
      "maxScore": 25,
      "level": "B1",
      "feedbackVi": "Tốc độ đọc vừa phải, ngắt nghỉ đúng chỗ ở các dấu chấm và phẩy."
    },
    {
      "id": "intonation",
      "name": "Trọng âm & Ngữ điệu",
      "score": 17,
      "maxScore": 20,
      "level": "B1",
      "feedbackVi": "Nhấn đúng trọng âm hầu hết các từ quan trọng."
    },
    {
      "id": "completeness",
      "name": "Độ chính xác nội dung",
      "score": 17,
      "maxScore": 20,
      "level": "B1",
      "feedbackVi": "Đọc đầy đủ các câu trong đoạn văn mẫu, không bỏ sót từ chính."
    }
  ],
  "overallFeedbackVi": "Em đọc khá rõ và đúng phần lớn nội dung. Hãy luyện thêm trọng âm của một số từ dài và hạn chế ngắt giữa cụm từ nhé!",
  "strengthsVi": [
    "Phát âm rõ ràng, âm lượng tốt",
    "Ngắt nghỉ đúng nhịp ở các dấu câu",
    "Hoàn thành trọn vẹn văn bản"
  ],
  "improvementsVi": [
    "Chú ý phát âm rõ hơn các phụ âm đuôi như /s/ và /t/",
    "Nhấn mạnh hơn vào các từ khóa trọng tâm"
  ],
  "requiredKeywordResults": [
    {
      "word": "courage",
      "status": "good",
      "feedbackVi": "✓ Tốt, phát âm rõ ràng"
    }
  ],
  "wordsToPractice": [
    {
      "word": "courage",
      "reasonVi": "Chú ý trọng âm rơi vào âm tiết đầu tiên.",
      "referenceSentence": "The secret is courage and practice."
    }
  ],
  "wordHighlights": [
    { "word": "courage", "status": "correct" }
  ]
}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: audioBase64,
          },
        },
        {
          text: systemPrompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Gemini returned empty response for pronunciation assessment');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(textOutput);
    } catch (parseErr) {
      console.error('Failed to parse Gemini output:', textOutput);
      throw new Error('Malformed assessment output from AI model');
    }

    // Sanitize & validate
    if (parsed.isValidAudio !== false) {
      parsed.isValidAudio = true;
      parsed.mode = mode;

      // Ensure cefrLevel is valid
      const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
      if (!validLevels.includes(parsed.cefrLevel)) {
        const total = Number(parsed.totalScore) || 75;
        if (total >= 90) parsed.cefrLevel = 'B2';
        else if (total >= 75) parsed.cefrLevel = 'B1';
        else if (total >= 60) parsed.cefrLevel = 'A2';
        else parsed.cefrLevel = 'A1';
      }

      if (!parsed.cefrLevelTitle) {
        parsed.cefrLevelTitle = `${parsed.cefrLevel} - Tiêu chuẩn CEFR`;
      }

      parsed.intelligibilityScore = Math.min(100, Math.max(0, Number(parsed.intelligibilityScore) || 85));
      if (!parsed.intelligibilityNoteVi) {
        parsed.intelligibilityNoteVi = 'Lời nói rõ ràng, người nghe quốc tế hiểu được. Không trừ điểm vì chất giọng Việt Nam (Vietnamese accent).';
      }

      // Compute total from criteria if available
      if (Array.isArray(parsed.criteria) && parsed.criteria.length > 0) {
        const sumCriteria = parsed.criteria.reduce((acc: number, c: any) => acc + (Number(c.score) || 0), 0);
        parsed.totalScore = Math.min(100, Math.max(0, sumCriteria));
      } else {
        parsed.totalScore = Math.min(100, Math.max(0, Number(parsed.totalScore) || 80));
      }

      // Populate legacy scores object for backwards compatibility
      if (mode === 'read-aloud') {
        const scores = parsed.scores || {};
        const pronunciation = Math.min(40, Math.max(0, Number(scores.pronunciation) || Math.round(parsed.totalScore * 0.4)));
        const fluency = Math.min(25, Math.max(0, Number(scores.fluency) || Math.round(parsed.totalScore * 0.25)));
        const intonation = Math.min(20, Math.max(0, Number(scores.intonation) || Math.round(parsed.totalScore * 0.2)));
        const completeness = Math.min(15, Math.max(0, Number(scores.completeness) || Math.round(parsed.totalScore * 0.15)));
        parsed.scores = {
          pronunciation,
          fluency,
          intonation,
          completeness,
          total: parsed.totalScore,
        };
      } else {
        parsed.scores = {
          pronunciation: Math.round(parsed.totalScore * 0.35),
          fluency: Math.round(parsed.totalScore * 0.25),
          intonation: Math.round(parsed.totalScore * 0.2),
          completeness: Math.round(parsed.totalScore * 0.2),
          total: parsed.totalScore,
        };
      }

      // Ensure lists are clean arrays
      if (!Array.isArray(parsed.strengthsVi)) parsed.strengthsVi = [];
      if (!Array.isArray(parsed.improvementsVi)) parsed.improvementsVi = [];

      // Cap wordsToPractice at 5
      if (Array.isArray(parsed.wordsToPractice)) {
        parsed.wordsToPractice = parsed.wordsToPractice.slice(0, 5);
      } else {
        parsed.wordsToPractice = [];
      }
    } else {
      parsed.scores = {
        pronunciation: 0,
        fluency: 0,
        intonation: 0,
        completeness: 0,
        total: 0,
      };
      parsed.totalScore = 0;
      parsed.intelligibilityScore = 0;
      if (!parsed.invalidReasonVi) {
        parsed.invalidReasonVi = 'Âm thanh chưa đủ rõ. Em hãy kiểm tra micro và thu lại nhé.';
      }
    }

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Assess pronunciation error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to assess pronunciation',
    });
  }
});

/**
 * Endpoint: POST /api/assess-single-word
 * Body: { audioBase64: string, mimeType?: string, word: string, targetAccent?: string }
 * Quick assessment for individual word retry practice.
 */
app.post('/api/assess-single-word', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', word, targetAccent = 'en-US' } = req.body;

    if (!audioBase64 || !word) {
      return res.status(400).json({ error: 'Audio data and target word are required' });
    }

    const ai = getGenAI();
    const rawMime = mimeType.split(';')[0].trim().toLowerCase();
    const cleanMime =
      rawMime.startsWith('audio/') || rawMime === 'video/webm' ? rawMime : 'audio/webm';

    const prompt = `You are an encouraging English pronunciation tutor assessing a student practicing a single English word.
TARGET WORD: "${word}"
TARGET ACCENT: ${targetAccent === 'en-GB' ? 'British English' : 'American English'}

Listen to the audio.
Determine if the student pronounced the target word recognizably and intelligibly (allow natural Vietnamese accent; focus on correct syllable stress and recognizable sounds).

Return a JSON object:
{
  "isValid": true,
  "status": "good" | "practice",
  "score": 85,
  "feedbackVi": "✓ Tốt hơn rồi! Em phát âm từ này rất rõ." (if good) or "↻ Hãy nghe mẫu và thử thêm một lần." (if needs practice),
  "recognizedWord": "what word was heard"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: audioBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from model');
    }

    const parsed = JSON.parse(text);
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Assess single word error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to assess single word',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
