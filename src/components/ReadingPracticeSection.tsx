import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Story,
  ReadingAssessmentResult,
  ReadingAttemptRecord,
  WordToPractice,
  RequiredKeywordAssessment,
  WordHighlight,
  PracticeMode,
  CEFRLevel,
  SpeakingQuestion,
  CEFRRubricCriterion,
} from '../types';
import { speakEnglish } from '../utils/speech';
import {
  saveReadingAttempt,
  loadReadingAttempts,
  getBestReadingScore,
  getPreviousReadingAttempt,
} from '../utils/storage';
import { getSpeakingQuestionsForStory } from '../utils/speakingQuestions';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  AlertCircle,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  FileText,
  History,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Headphones,
  Globe,
  Check,
  HelpCircle,
  Sparkle,
} from 'lucide-react';

interface ReadingPracticeSectionProps {
  story: Story;
  speechRate: number;
  onUpdateWordHighlights?: (highlights: WordHighlight[]) => void;
  onSelectKeywordDirect?: (keyword: string) => void;
}

type RecordState = 'idle' | 'recording' | 'stopped' | 'assessing';
type FontSizeOption = 'normal' | 'large' | 'xlarge';

export const ReadingPracticeSection: React.FC<ReadingPracticeSectionProps> = ({
  story,
  speechRate,
  onUpdateWordHighlights,
  onSelectKeywordDirect,
}) => {
  // 1. PRACTICE MODE: 'read-aloud' (Đọc văn bản) or 'speaking' (Tự trả lời câu hỏi)
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('read-aloud');

  // 2. READ ALOUD SPECIFIC CONTROLS
  // Select which part to read: 'all' or paragraph id 'p1', 'p2', etc.
  const [selectedParagraphId, setSelectedParagraphId] = useState<string>('all');
  const [fontSize, setFontSize] = useState<FontSizeOption>('large');

  // 3. SPEAKING SPECIFIC CONTROLS
  const speakingQuestions: SpeakingQuestion[] = useMemo(() => {
    return getSpeakingQuestionsForStory(story);
  }, [story]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [showStoryRefForSpeaking, setShowStoryRefForSpeaking] = useState<boolean>(false);
  const [showSampleStarter, setShowSampleStarter] = useState<boolean>(true);

  // Target Accent selection (en-US or en-GB)
  const [targetAccent, setTargetAccent] = useState<'en-US' | 'en-GB'>('en-US');

  // Full Model Reading TTS state
  const [isPlayingModelAudio, setIsPlayingModelAudio] = useState(false);

  // Recording states
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState(false);
  const [recordedPlayTime, setRecordedPlayTime] = useState(0);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Assessment results
  const [assessmentResult, setAssessmentResult] = useState<ReadingAssessmentResult | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  // Practice word retry state: which word is being practiced
  const [retryingWord, setRetryingWord] = useState<string | null>(null);
  const [wordRecordState, setWordRecordState] = useState<'idle' | 'recording' | 'recorded' | 'assessing'>('idle');
  const [wordAudioBlob, setWordAudioBlob] = useState<Blob | null>(null);
  const [wordAudioUrl, setWordAudioUrl] = useState<string | null>(null);
  const [wordFeedback, setWordFeedback] = useState<{ status: 'good' | 'practice'; message: string } | null>(null);
  const wordMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wordStreamRef = useRef<MediaStream | null>(null);
  const wordAudioChunksRef = useRef<Blob[]>([]);

  // Toggle sections
  const [showTranscript, setShowTranscript] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Attempt History for this story
  const [attempts, setAttempts] = useState<ReadingAttemptRecord[]>([]);

  // Load attempt history on mount / story change
  useEffect(() => {
    const list = loadReadingAttempts(story.id);
    setAttempts(list);
  }, [story.id]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (wordAudioUrl) URL.revokeObjectURL(wordAudioUrl);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wordStreamRef.current) {
        wordStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl, wordAudioUrl]);

  // Handle switching modes: clear active temporary recording & result to avoid confusion
  const handleSwitchMode = (newMode: PracticeMode) => {
    if (newMode === practiceMode) return;
    if (recordState === 'recording') {
      handleStopRecording();
    }
    handleDiscardAndRetry();
    setPracticeMode(newMode);
  };

  // Complete story reference text
  const fullReferenceText = useMemo(() => {
    return story.paragraphs.map((p) => p.text).join('\n\n');
  }, [story.paragraphs]);

  // The active reference text currently selected for Read Aloud
  const activeReadingText = useMemo(() => {
    if (selectedParagraphId === 'all') {
      return fullReferenceText;
    }
    const found = story.paragraphs.find((p) => p.id === selectedParagraphId);
    return found ? found.text : fullReferenceText;
  }, [selectedParagraphId, fullReferenceText, story.paragraphs]);

  // Active speaking question
  const currentSpeakingQuestion = useMemo(() => {
    return speakingQuestions[selectedQuestionIndex] || speakingQuestions[0];
  }, [speakingQuestions, selectedQuestionIndex]);

  // Required keyword list for assessment
  const requiredKeywordsList = useMemo(() => {
    if (story.requiredKeywords && story.requiredKeywords.length > 0) {
      return story.requiredKeywords.map((k) => k.text);
    }
    return story.keywords || [];
  }, [story.requiredKeywords, story.keywords]);

  // PLAY MODEL AUDIO (TTS)
  const handlePlayModelAudio = () => {
    if (isPlayingModelAudio) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingModelAudio(false);
      return;
    }

    setIsPlayingModelAudio(true);
    const textToSpeak = practiceMode === 'read-aloud'
      ? activeReadingText
      : (currentSpeakingQuestion.modelAnswer || currentSpeakingQuestion.question);

    speakEnglish(textToSpeak, speechRate);

    const words = textToSpeak.split(/\s+/).length;
    const estSeconds = Math.max(4, Math.ceil((words / 130) * 60));
    setTimeout(() => {
      setIsPlayingModelAudio(false);
    }, estSeconds * 1000);
  };

  // START RECORDING
  const handleStartRecording = async () => {
    setAssessmentError(null);
    setAssessmentResult(null);

    // Discard any existing recording
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setRecordState('stopped');

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setRecordState('recording');

      timerIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      let errorMsg = 'Không thể truy cập micro. Em hãy kiểm tra và cấp quyền micro cho trình duyệt nhé!';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Quyền sử dụng micro đã bị từ chối. Vui lòng cho phép trình duyệt truy cập micro để luyện nói/đọc.';
      }
      setAssessmentError(errorMsg);
      setRecordState('idle');
    }
  };

  // STOP RECORDING
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // DISCARD RECORDING
  const handleDiscardAndRetry = () => {
    if (isPlayingRecordedAudio && playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setIsPlayingRecordedAudio(false);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordDuration(0);
    setRecordState('idle');
    setAssessmentResult(null);
    setAssessmentError(null);
  };

  // PLAYBACK STUDENT RECORDING
  const handleTogglePlayback = () => {
    if (!audioUrl) return;

    if (!playbackAudioRef.current) {
      const audio = new Audio(audioUrl);
      playbackAudioRef.current = audio;

      audio.ontimeupdate = () => {
        setRecordedPlayTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlayingRecordedAudio(false);
        setRecordedPlayTime(0);
      };
    }

    if (isPlayingRecordedAudio) {
      playbackAudioRef.current.pause();
      setIsPlayingRecordedAudio(false);
    } else {
      playbackAudioRef.current
        .play()
        .then(() => {
          setIsPlayingRecordedAudio(true);
        })
        .catch((e) => console.warn('Play error:', e));
    }
  };

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // SUBMIT RECORDING FOR CEFR ASSESSMENT
  const handleAssessCEFR = async () => {
    if (!audioBlob) return;

    setIsAssessing(true);
    setRecordState('assessing');
    setAssessmentError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);

      const audioBase64 = await base64Promise;

      const payload = practiceMode === 'read-aloud'
        ? {
            audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
            mode: 'read-aloud',
            referenceText: activeReadingText,
            requiredKeywords: requiredKeywordsList,
            targetAccent,
            storyTitle: story.title,
          }
        : {
            audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
            mode: 'speaking',
            question: currentSpeakingQuestion.question,
            questionVi: currentSpeakingQuestion.questionVi,
            suggestedKeywords: currentSpeakingQuestion.suggestedKeywords || [],
            targetAccent,
            storyTitle: story.title,
          };

      const response = await fetch('/api/assess-pronunciation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Đánh giá CEFR không thành công');
      }

      const result: ReadingAssessmentResult = json.data;
      setAssessmentResult(result);

      if (!result.isValidAudio) {
        setAssessmentError(
          result.invalidReasonVi ||
            'Âm thanh chưa đủ rõ. Em hãy kiểm tra micro và thu lại nhé.',
        );
        setIsAssessing(false);
        setRecordState('stopped');
        return;
      }

      // Save attempt to history
      const totalScore = result.totalScore || result.scores?.total || 0;
      const attemptId = `attempt_${Date.now()}`;
      setCurrentAttemptId(attemptId);

      const newAttempt: ReadingAttemptRecord = {
        id: attemptId,
        storyId: story.id,
        timestamp: new Date().toISOString(),
        mode: practiceMode,
        cefrLevel: result.cefrLevel,
        cefrLevelTitle: result.cefrLevelTitle,
        intelligibilityScore: result.intelligibilityScore,
        totalScore,
        pronunciationScore: result.scores?.pronunciation || 0,
        fluencyScore: result.scores?.fluency || 0,
        intonationScore: result.scores?.intonation || 0,
        completenessScore: result.scores?.completeness || 0,
        criteria: result.criteria,
        overallFeedbackVi: result.overallFeedbackVi,
        transcript: result.transcript,
        questionText: practiceMode === 'speaking' ? currentSpeakingQuestion.question : undefined,
        wordsToPractice: result.wordsToPractice,
        requiredKeywordResults: result.requiredKeywordResults,
        strengthsVi: result.strengthsVi,
        improvementsVi: result.improvementsVi,
        suggestedBetterPhrasing: result.suggestedBetterPhrasing,
      };

      saveReadingAttempt(newAttempt);
      setAttempts(loadReadingAttempts(story.id));

      if (result.wordHighlights && onUpdateWordHighlights) {
        onUpdateWordHighlights(result.wordHighlights);
      }

      setIsAssessing(false);
      setRecordState('stopped');
    } catch (err: any) {
      console.error('Assessment failed:', err);
      setAssessmentError(
        err?.message ||
          'Không thể kết nối đến máy chủ chấm bài. Em hãy kiểm tra kết nối mạng và thử lại nhé!',
      );
      setIsAssessing(false);
      setRecordState('stopped');
    }
  };

  // Previous attempt for comparison
  const previousAttempt = useMemo(() => {
    if (!currentAttemptId) {
      return attempts.length > 0 ? attempts[0] : null;
    }
    return getPreviousReadingAttempt(story.id, currentAttemptId);
  }, [attempts, currentAttemptId, story.id]);

  const bestScore = useMemo(() => {
    return getBestReadingScore(story.id);
  }, [attempts, story.id]);

  const scoreDiff = useMemo(() => {
    const currentScore = assessmentResult?.totalScore || assessmentResult?.scores?.total;
    if (currentScore === undefined || !previousAttempt) return null;
    return currentScore - previousAttempt.totalScore;
  }, [assessmentResult, previousAttempt]);

  // CEFR Badge visual config
  const getCEFRBadge = (level?: CEFRLevel) => {
    switch (level) {
      case 'C1':
        return {
          bg: 'bg-purple-600 text-white',
          border: 'border-purple-300',
          label: 'C1 - Cao cấp (Advanced)',
          desc: 'Thành thạo, tự nhiên, kiểm soát ngôn ngữ xuất sắc.',
        };
      case 'B2':
        return {
          bg: 'bg-indigo-600 text-white',
          border: 'border-indigo-300',
          label: 'B2 - Tự tin (Upper-Intermediate)',
          desc: 'Nói lưu loát, ý tứ phong phú, phát âm rõ ràng.',
        };
      case 'B1':
        return {
          bg: 'bg-blue-600 text-white',
          border: 'border-blue-300',
          label: 'B1 - Trung cấp (Intermediate)',
          desc: 'Giao tiếp rõ ý, tự tin, người nghe quốc tế hiểu tốt.',
        };
      case 'A2':
        return {
          bg: 'bg-teal-600 text-white',
          border: 'border-teal-300',
          label: 'A2 - Cơ bản (Elementary)',
          desc: 'Trả lời đúng ý câu hỏi, câu ngắn gọn, phát âm dễ hiểu.',
        };
      case 'A1':
      default:
        return {
          bg: 'bg-amber-600 text-white',
          border: 'border-amber-300',
          label: 'A1 - Khởi đầu (Beginner)',
          desc: 'Nhận biết từ cơ bản, cần luyện tập thêm để nói trôi chảy hơn.',
        };
    }
  };

  // INDIVIDUAL WORD RETRY HANDLERS (for Read Aloud)
  const handleOpenWordRetry = (word: string) => {
    setRetryingWord(word);
    setWordRecordState('idle');
    setWordAudioBlob(null);
    setWordAudioUrl(null);
    setWordFeedback(null);
  };

  const handleStartWordRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      wordStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      wordMediaRecorderRef.current = recorder;
      wordAudioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          wordAudioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(wordAudioChunksRef.current, { type: mimeType });
        setWordAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setWordAudioUrl(url);
        setWordRecordState('recorded');

        if (wordStreamRef.current) {
          wordStreamRef.current.getTracks().forEach((t) => t.stop());
          wordStreamRef.current = null;
        }
      };

      recorder.start(100);
      setWordRecordState('recording');
    } catch (e) {
      console.error('Word record failed:', e);
    }
  };

  const handleStopWordRecording = () => {
    if (wordMediaRecorderRef.current && wordMediaRecorderRef.current.state !== 'inactive') {
      wordMediaRecorderRef.current.stop();
    }
  };

  const handleAssessWord = async () => {
    if (!wordAudioBlob || !retryingWord) return;
    setWordRecordState('assessing');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(wordAudioBlob);
      const audioBase64 = await base64Promise;

      const resp = await fetch('/api/assess-single-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: wordAudioBlob.type || 'audio/webm',
          word: retryingWord,
          targetAccent,
        }),
      });

      const json = await resp.json();
      if (json.success && json.data) {
        setWordFeedback({
          status: json.data.status === 'good' ? 'good' : 'practice',
          message: json.data.feedbackVi || (json.data.status === 'good' ? 'Phát âm rất tốt!' : 'Cần chú ý thêm.'),
        });

        if (assessmentResult && assessmentResult.wordsToPractice) {
          const updated = assessmentResult.wordsToPractice.map((w) =>
            w.word.toLowerCase() === retryingWord.toLowerCase()
              ? { ...w, status: json.data.status === 'good' ? ('improved' as const) : ('retry' as const) }
              : w,
          );
          setAssessmentResult({
            ...assessmentResult,
            wordsToPractice: updated,
          });
        }
      }
      setWordRecordState('recorded');
    } catch (err) {
      console.error('Single word assess failed:', err);
      setWordRecordState('recorded');
    }
  };

  return (
    <section
      id="reading-practice-section"
      className="mt-12 pt-8 border-t-2 border-purple-200/80 space-y-6"
    >
      {/* 1. Header & Main Mode Switcher */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-200/80 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-purple-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#7B3FE4] via-[#D33BE8] to-[#04D1EC] text-white shadow-md shadow-purple-900/15">
                <Mic className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-sans">
                    CHẤM ĐIỂM SPEAKING &amp; READING CEFR
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-2xs">
                    Chuẩn CEFR Quốc tế
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                  Đánh giá năng lực phát âm và diễn đạt theo khung tham chiếu châu Âu (CEFR A1 – B2).
                </p>
              </div>
            </div>
          </div>

          {/* Target Accent Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-auto">
            <span className="text-xs font-semibold text-slate-600 px-2 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Giọng chuẩn:</span>
            </span>
            <button
              type="button"
              id="btn-accent-us"
              onClick={() => setTargetAccent('en-US')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                targetAccent === 'en-US'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🇺🇸 Mỹ (en-US)
            </button>
            <button
              type="button"
              id="btn-accent-gb"
              onClick={() => setTargetAccent('en-GB')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                targetAccent === 'en-GB'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🇬🇧 Anh (en-GB)
            </button>
          </div>
        </div>

        {/* 2 DISTINCT MODES SELECTOR */}
        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5">
          <button
            type="button"
            id="tab-mode-read-aloud"
            onClick={() => handleSwitchMode('read-aloud')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              practiceMode === 'read-aloud'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>1. READ ALOUD – Đọc đoạn văn có sẵn</span>
          </button>

          <button
            type="button"
            id="tab-mode-speaking"
            onClick={() => handleSwitchMode('speaking')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              practiceMode === 'speaking'
                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>2. SPEAKING – Tự trả lời câu hỏi bằng lời nói</span>
          </button>
        </div>

        {/* CEFR & VIETNAMESE ACCENT TRANSPARENCY BANNER */}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 text-xs text-slate-700">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>Tiêu chí CEFR: Ưu tiên Độ dễ hiểu (Intelligibility) &amp; Khả năng truyền đạt</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              Hệ thống khảo thí theo chuẩn CEFR <strong>không yêu cầu accent người bản xứ</strong>. Điểm số tập trung vào việc người nghe có hiểu rõ em nói gì không (intelligibility), trọng âm từ và sự liền mạch. <strong>Tuyệt đối không trừ điểm chỉ vì học sinh có Vietnamese accent.</strong>
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* READ ALOUD MODE: HIỂN THỊ NỘI DUNG BÀI ĐỌC ĐỂ NHÌN & GHI ÂM */}
        {/* ---------------------------------------------------- */}
        {practiceMode === 'read-aloud' && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/70">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-slate-900">
                  CHỌN ĐOẠN VĂN ĐỂ ĐỌC &amp; GHI ÂM:
                </span>
              </div>

              {/* Paragraph Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedParagraphId('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    selectedParagraphId === 'all'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-amber-100/50 border border-slate-200'
                  }`}
                >
                  Toàn bài ({story.paragraphs.length} đoạn)
                </button>
                {story.paragraphs.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedParagraphId(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedParagraphId === p.id
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-amber-100/50 border border-slate-200'
                    }`}
                  >
                    Đoạn {idx + 1}
                  </button>
                ))}
              </div>

              {/* Font size adjustment */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 self-end sm:self-auto">
                <span className="text-[11px] text-slate-400 px-1 font-bold">Cỡ chữ:</span>
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`px-2 py-1 text-xs rounded-lg font-bold cursor-pointer ${
                    fontSize === 'normal' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Cỡ chữ thường"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('large')}
                  className={`px-2 py-1 text-xs rounded-lg font-bold cursor-pointer ${
                    fontSize === 'large' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Cỡ chữ lớn"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('xlarge')}
                  className={`px-2 py-1 text-xs rounded-lg font-bold cursor-pointer ${
                    fontSize === 'xlarge' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Cỡ chữ rất lớn"
                >
                  A++
                </button>
              </div>
            </div>

            {/* TELEPROMPTER / READING TEXT DISPLAY CARD */}
            <div
              className={`p-6 rounded-3xl border transition-all duration-300 relative ${
                recordState === 'recording'
                  ? 'bg-rose-50/40 border-rose-400 ring-4 ring-rose-200/60 shadow-md'
                  : 'bg-gradient-to-b from-amber-50/30 to-white border-amber-200/90 shadow-2xs'
              }`}
            >
              {/* Header indicator inside teleprompter */}
              <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-amber-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-bold text-slate-800 uppercase tracking-wider">
                    {selectedParagraphId === 'all'
                      ? `Toàn bộ bài đọc: "${story.title}"`
                      : `Đoạn ${story.paragraphs.findIndex((p) => p.id === selectedParagraphId) + 1} / ${story.paragraphs.length}`}
                  </span>
                  <span className="text-slate-400 font-medium">
                    ({activeReadingText.split(/\s+/).length} từ)
                  </span>
                </div>

                {recordState === 'recording' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    ĐANG THU ÂM – HÃY NHÌN VÀO ĐÂY ĐỂ ĐỌC
                  </span>
                )}
              </div>

              {/* The Reading Text */}
              <div
                className={`leading-relaxed text-slate-800 font-serif whitespace-pre-line select-text ${
                  fontSize === 'normal'
                    ? 'text-base sm:text-lg leading-loose'
                    : fontSize === 'large'
                    ? 'text-lg sm:text-xl leading-loose font-medium'
                    : 'text-xl sm:text-2xl leading-loose font-medium'
                }`}
              >
                {activeReadingText}
              </div>

              {/* Tip below reading text */}
              <div className="mt-4 pt-3 border-t border-amber-100/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  💡 <em>Mẹo:</em> Giữ nhịp đọc từ tốn, ngắt nghỉ nhẹ ở các dấu phẩy và dấu chấm để đạt điểm Fluency cao.
                </span>
                {requiredKeywordsList.length > 0 && (
                  <span className="text-amber-800 font-medium">
                    Từ khóa cần chú ý: {requiredKeywordsList.slice(0, 4).join(', ')}...
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* SPEAKING MODE: BỘ CÂU HỎI & NỘI DUNG THAM KHẢO */}
        {/* ---------------------------------------------------- */}
        {practiceMode === 'speaking' && (
          <div className="space-y-4 pt-2">
            {/* Question Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200/70">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 mr-2">
                <MessageSquare className="w-4 h-4 text-indigo-700" />
                <span>CHỌN CÂU HỎI:</span>
              </span>
              {speakingQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setSelectedQuestionIndex(idx);
                    handleDiscardAndRetry();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedQuestionIndex === idx
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/50'
                  }`}
                >
                  Câu {idx + 1}
                </button>
              ))}
            </div>

            {/* SPEAKING PROMPT CARD */}
            <div
              className={`p-6 rounded-3xl border transition-all duration-300 relative ${
                recordState === 'recording'
                  ? 'bg-rose-50/40 border-rose-400 ring-4 ring-rose-200/60 shadow-md'
                  : 'bg-gradient-to-b from-indigo-50/40 to-white border-indigo-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-indigo-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="font-bold text-indigo-950 uppercase tracking-wider">
                    CÂU HỎI LUYỆN NÓI SỐ {selectedQuestionIndex + 1}
                  </span>
                </div>

                {recordState === 'recording' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    ĐANG THU ÂM CÂU TRẢ LỜI CỦA EM
                  </span>
                )}
              </div>

              {/* Question in English & Vietnamese */}
              <div className="space-y-2">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif leading-snug">
                  &ldquo;{currentSpeakingQuestion.question}&rdquo;
                </h4>
                {currentSpeakingQuestion.questionVi && (
                  <p className="text-sm font-medium text-slate-600 italic">
                    Dịch nghĩa: {currentSpeakingQuestion.questionVi}
                  </p>
                )}
              </div>

              {/* Sentence starter & Suggested ideas */}
              <div className="mt-5 pt-4 border-t border-indigo-100 space-y-3">
                {currentSpeakingQuestion.starterPhrase && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs">
                    <Lightbulb className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950">Gợi ý mở đầu câu trả lời: </span>
                      <strong className="text-amber-900 font-mono text-[13px]">{currentSpeakingQuestion.starterPhrase}</strong>
                    </div>
                  </div>
                )}

                {currentSpeakingQuestion.suggestedKeywords && currentSpeakingQuestion.suggestedKeywords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Từ khóa nên vận dụng:</span>
                    {currentSpeakingQuestion.suggestedKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold font-mono text-[11px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle: View Story Reference to get Ideas */}
              <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowStoryRefForSpeaking((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {showStoryRefForSpeaking
                      ? 'Ẩn nội dung câu chuyện'
                      : '📖 Mở xem lại nội dung câu chuyện để lấy ý tưởng'}
                  </span>
                  {showStoryRefForSpeaking ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Collapsible Story Reference Accordion */}
              {showStoryRefForSpeaking && (
                <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 max-h-56 overflow-y-auto leading-relaxed font-serif space-y-2">
                  <div className="font-sans font-bold text-slate-900 pb-1 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    Tham khảo nội dung: {story.title}
                  </div>
                  {story.paragraphs.map((p, i) => (
                    <p key={p.id}>
                      <strong className="font-sans text-slate-400">Đoạn {i + 1}: </strong>
                      {p.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* RECORDING STATUS & TIMER BAR */}
        {/* ---------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            {recordState === 'idle' && (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                🎙 Sẵn sàng thu âm ({practiceMode === 'read-aloud' ? 'Read Aloud' : 'Speaking'})
              </span>
            )}
            {recordState === 'recording' && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-rose-600 animate-pulse">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                🔴 Đang thu âm... Hãy nói rõ ràng, tự nhiên
              </span>
            )}
            {recordState === 'stopped' && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ✓ Đã thu âm xong ({formatTime(recordDuration)})
              </span>
            )}
            {recordState === 'assessing' && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-700">
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                ✨ AI Examiner đang phân tích audio và chấm theo thang CEFR...
              </span>
            )}
          </div>

          {(recordState === 'recording' || (recordState === 'stopped' && recordDuration > 0)) && (
            <div className="font-mono text-base font-bold text-slate-900 bg-white px-3.5 py-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
              ⏱ {formatTime(recordDuration)}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------- */}
        {/* ACTION BUTTONS */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. NGHE MẪU */}
          <button
            type="button"
            id="btn-listen-sample-reading"
            onClick={handlePlayModelAudio}
            className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-2xs ${
              isPlayingModelAudio
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-white text-slate-800 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <Volume2 className={`w-4 h-4 ${isPlayingModelAudio ? 'animate-bounce' : 'text-amber-600'}`} />
            <span>{isPlayingModelAudio ? 'Đang đọc mẫu...' : practiceMode === 'read-aloud' ? '🔊 NGHE ĐỌC MẪU' : '🔊 NGHE CÂU HỎI'}</span>
          </button>

          {/* 2. BẮT ĐẦU / DỪNG THU ÂM */}
          {recordState !== 'recording' ? (
            <button
              type="button"
              id="btn-start-recording"
              onClick={handleStartRecording}
              disabled={recordState === 'assessing'}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs shadow-xs hover:shadow flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>🎙 BẮT ĐẦU THU ÂM</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-stop-recording"
              onClick={handleStopRecording}
              className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer animate-pulse"
            >
              <Square className="w-4 h-4 text-rose-400" />
              <span>⏹ DỪNG THU ÂM</span>
            </button>
          )}

          {/* 3. NGHE LẠI GIỌNG THU ÂM CỦA EM */}
          <button
            type="button"
            id="btn-playback-recording"
            onClick={handleTogglePlayback}
            disabled={!audioUrl || recordState === 'recording'}
            className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-2xs ${
              !audioUrl || recordState === 'recording'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : isPlayingRecordedAudio
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
            }`}
          >
            {isPlayingRecordedAudio ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Tạm dừng ({formatTime(recordedPlayTime)})</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-blue-600" />
                <span>▶ NGHE LẠI GIỌNG MÌNH</span>
              </>
            )}
          </button>

          {/* 4. THU LẠI */}
          <button
            type="button"
            id="btn-retry-recording"
            onClick={handleDiscardAndRetry}
            disabled={!audioUrl || recordState === 'recording' || recordState === 'assessing'}
            className={`p-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-2xs ${
              !audioUrl || recordState === 'recording' || recordState === 'assessing'
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>🔄 THU LẠI</span>
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* PRIMARY CEFR ASSESSMENT TRIGGER BUTTON */}
        {/* ---------------------------------------------------- */}
        {recordState === 'stopped' && audioBlob && !assessmentResult && (
          <div className="pt-3 border-t border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Bản thu âm của em đã sẵn sàng!</span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Bấm nút chấm điểm để AI Examiner phân tích âm thanh, chuyển thành văn bản và đánh giá theo chuẩn CEFR.
              </p>
            </div>

            <button
              type="button"
              id="btn-submit-assessment"
              onClick={handleAssessCEFR}
              disabled={isAssessing}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer shrink-0 disabled:opacity-60"
            >
              {isAssessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang chấm theo chuẩn CEFR...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-200" />
                  <span>✨ CHẤM ĐIỂM CHUẨN CEFR</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error / Bad Recording Handler */}
        {assessmentError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-rose-900">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900">
                  Không thể chấm bài này
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  {assessmentError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartRecording}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
            >
              🎙 THU LẠI
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. CEFR ASSESSMENT RESULTS DISPLAY AREA */}
      {/* ---------------------------------------------------- */}
      {assessmentResult && (
        <div
          id="reading-assessment-result-panel"
          className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500"
        >
          {/* Top Score Title, CEFR Band & Intelligibility Badge */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-amber-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Award className="w-4 h-4 text-amber-600" />
                <span>KẾT QUẢ KHẢO THÍ THEO CHUẨN CEFR &bull; {assessmentResult.mode === 'speaking' ? 'SPEAKING' : 'READ ALOUD'}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900">
                {assessmentResult.mode === 'speaking' ? 'Đánh giá kỹ năng Nói (CEFR Speaking)' : 'Đánh giá kỹ năng Đọc (CEFR Reading Aloud)'}
              </h3>
              <p className="text-xs text-slate-500">
                {assessmentResult.cefrLevelDescriptionVi || 'Đánh giá toàn diện dựa trên độ dễ hiểu, phát âm, độ trôi chảy và ngữ pháp.'}
              </p>
            </div>

            {/* Total Score & CEFR Level Box */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 rounded-3xl border border-amber-200/90 shadow-2xs self-start lg:self-auto">
              {/* CEFR Band Badge */}
              <div className="flex flex-col items-center justify-center px-3 py-1 bg-white rounded-2xl border border-amber-200 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400">BẬC CEFR</span>
                <span className={`text-2xl font-black px-3 py-0.5 rounded-xl mt-0.5 ${getCEFRBadge(assessmentResult.cefrLevel).bg}`}>
                  {assessmentResult.cefrLevel || 'A2'}
                </span>
                <span className="text-[10px] font-bold text-slate-600 mt-1">
                  {assessmentResult.cefrLevelTitle?.split(' - ')[1] || 'Intermediate'}
                </span>
              </div>

              {/* Total Numeric Score */}
              <div className="text-right pl-2 border-l border-amber-200/80">
                <div className="text-3xl sm:text-4xl font-black text-amber-950 font-serif leading-none">
                  {assessmentResult.totalScore || assessmentResult.scores?.total || 0}
                  <span className="text-sm font-medium text-slate-400"> / 100</span>
                </div>
                <div className="text-[11px] font-semibold text-amber-800 mt-1">
                  Tổng điểm quy đổi
                </div>
              </div>
            </div>
          </div>

          {/* Intelligibility Meter (Độ Dễ Hiểu - Không trừ điểm vì Vietnamese accent) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  CHỈ SỐ DỄ HIỂU (INTELLIGIBILITY): {assessmentResult.intelligibilityScore || 90}%
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {assessmentResult.intelligibilityNoteVi ||
                  'Lời nói rõ ràng, người nghe quốc tế hiểu được đầy đủ. Tuyệt đối không trừ điểm vì chất giọng Việt Nam (Vietnamese accent).'}
              </p>
            </div>

            <div className="w-full sm:w-48 bg-white/80 rounded-full h-3.5 border border-emerald-200 overflow-hidden shrink-0">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(10, assessmentResult.intelligibilityScore || 85))}%` }}
              />
            </div>
          </div>

          {/* Improvement tracking from previous attempt */}
          {(previousAttempt || bestScore !== null) && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                {previousAttempt && (
                  <span className="text-slate-600">
                    Lần trước: <strong className="text-slate-900">{previousAttempt.totalScore} điểm</strong> ({previousAttempt.cefrLevel || 'A2'})
                  </span>
                )}
                <span className="text-slate-600">
                  Lần này: <strong className="text-slate-900">{assessmentResult.totalScore || assessmentResult.scores?.total} điểm</strong> ({assessmentResult.cefrLevel})
                </span>
                {scoreDiff !== null && (
                  <span
                    className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${
                      scoreDiff > 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : scoreDiff < 0
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>{scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} điểm so với lần trước</span>
                  </span>
                )}
              </div>

              {bestScore !== null && (
                <div className="text-amber-900 font-semibold flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>Điểm cao nhất: <strong>{bestScore}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* CEFR RUBRIC CRITERIA GRID */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              CHI TIẾT CÁC TIÊU CHÍ RUBRIC CEFR:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(assessmentResult.criteria && assessmentResult.criteria.length > 0
                ? assessmentResult.criteria
                : [
                    {
                      id: 'pronunciation',
                      name: 'Độ dễ hiểu & Phát âm',
                      score: assessmentResult.scores?.pronunciation || 28,
                      maxScore: 35,
                      level: assessmentResult.cefrLevel || 'B1',
                      feedbackVi: 'Phát âm to, rõ ràng, các nguyên âm và phụ âm chính chuẩn xác.',
                    },
                    {
                      id: 'fluency',
                      name: 'Độ trôi chảy & Ngắt nhịp',
                      score: assessmentResult.scores?.fluency || 20,
                      maxScore: 25,
                      level: assessmentResult.cefrLevel || 'B1',
                      feedbackVi: 'Tốc độ đọc/nói tự nhiên, biết ngắt nhịp ở các vế câu.',
                    },
                    {
                      id: 'intonation',
                      name: 'Trọng âm & Ngữ điệu',
                      score: assessmentResult.scores?.intonation || 16,
                      maxScore: 20,
                      level: assessmentResult.cefrLevel || 'B1',
                      feedbackVi: 'Nhấn đúng trọng âm từ và duy trì ngữ điệu câu tốt.',
                    },
                    {
                      id: 'completeness',
                      name: 'Độ chính xác nội dung',
                      score: assessmentResult.scores?.completeness || 16,
                      maxScore: 20,
                      level: assessmentResult.cefrLevel || 'B1',
                      feedbackVi: 'Đọc/trả lời đầy đủ, đáp ứng tốt yêu cầu bài tập.',
                    },
                  ]
              ).map((c: CEFRRubricCriterion) => (
                <div key={c.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                        {c.level || assessmentResult.cefrLevel}
                      </span>
                      <span className="text-xs font-black text-slate-900 font-mono">
                        {c.score} / {c.maxScore}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, (c.score / c.maxScore) * 100))}%` }}
                    />
                  </div>

                  {c.feedbackVi && (
                    <p className="text-[11px] text-slate-600 leading-normal pt-1">
                      {c.feedbackVi}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* VERBATIM TRANSCRIPT (Bản ghi lời nói của em - AI đã nghe được gì) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>BẢN GHI LỜI NÓI (TRANSCRIPT – AI ĐÃ NGHE ĐƯỢC GÌ):</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscript((prev) => !prev)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{showTranscript ? 'Thu gọn' : 'Mở xem'}</span>
                {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showTranscript && (
              <div className="pt-2">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono">
                  {assessmentResult.transcript || 'Chưa có bản ghi lời nói.'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  AI nhận diện nguyên văn từng từ em đã nói để đối chiếu rubric CEFR.
                </p>
              </div>
            )}
          </div>

          {/* OVERALL FEEDBACK, STRENGTHS & NEXT CEFR STEPS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ĐIỂM MẠNH ĐÃ LÀM TỐT:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {(assessmentResult.strengthsVi && assessmentResult.strengthsVi.length > 0
                  ? assessmentResult.strengthsVi
                  : [
                      'Phát âm rõ ràng, âm lượng tốt',
                      'Truyền tải được nội dung thông điệp chính',
                    ]
                ).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">&bull;</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvement Tips to Reach Next CEFR Level */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span>GÓP Ý ĐỂ LÊN BẬC CEFR TIẾP THEO:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-950">
                {(assessmentResult.improvementsVi && assessmentResult.improvementsVi.length > 0
                  ? assessmentResult.improvementsVi
                  : [
                      'Chú ý phát âm rõ hơn các phụ âm đuôi như /s/, /t/',
                      'Luyện tập ngắt nghỉ nhịp nhàng ở các dấu câu',
                    ]
                ).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">&bull;</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* SPEAKING SPECIAL: GRAMMAR & BETTER PHRASING */}
          {assessmentResult.mode === 'speaking' && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 uppercase tracking-wider">
                <Lightbulb className="w-4 h-4 text-indigo-600" />
                <span>NHẬN XÉT NGỮ PHÁP &amp; CÁCH NÓI NÂNG CAO (CEFR BOOST):</span>
              </div>

              {assessmentResult.grammarFeedbackVi && (
                <div className="p-3.5 rounded-xl bg-white border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <span className="font-bold text-indigo-900">Nhận xét ngữ pháp:</span>
                  <p className="leading-relaxed">{assessmentResult.grammarFeedbackVi}</p>
                </div>
              )}

              {assessmentResult.suggestedBetterPhrasing && (
                <div className="p-3.5 rounded-xl bg-white border border-indigo-100 text-xs text-indigo-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900">Cách diễn đạt hay hơn ở bậc CEFR cao hơn:</span>
                    <button
                      type="button"
                      onClick={() => speakEnglish(assessmentResult.suggestedBetterPhrasing || '', speechRate)}
                      className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] flex items-center gap-1 hover:bg-indigo-100 cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Nghe mẫu</span>
                    </button>
                  </div>
                  <p className="leading-relaxed font-serif text-[13px] text-slate-800">
                    &ldquo;{assessmentResult.suggestedBetterPhrasing}&rdquo;
                  </p>
                </div>
              )}

              {assessmentResult.suggestedVocabulary && assessmentResult.suggestedVocabulary.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600 font-medium">Từ vựng gợi ý cho lần tới:</span>
                  {assessmentResult.suggestedVocabulary.map((item, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 font-bold text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* READ ALOUD SPECIAL: REQUIRED KEYWORDS ASSESSMENT */}
          {assessmentResult.mode === 'read-aloud' && assessmentResult.requiredKeywordResults && assessmentResult.requiredKeywordResults.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>ĐÁNH GIÁ CÁC TỪ KHÓA IN ĐẬM CỦA BÀI:</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {assessmentResult.requiredKeywordResults.filter((k) => k.status === 'good').length} / {assessmentResult.requiredKeywordResults.length} từ đạt chuẩn
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {assessmentResult.requiredKeywordResults.map((kw: RequiredKeywordAssessment) => (
                  <div
                    key={kw.word}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      kw.status === 'good'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div>
                      <div className="font-bold font-mono text-[13px]">{kw.word}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{kw.feedbackVi}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakEnglish(kw.word, speechRate)}
                      className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 cursor-pointer shadow-2xs shrink-0"
                      title="Nghe phát âm từ này"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* READ ALOUD SPECIAL: WORDS TO PRACTICE WITH SINGLE RETRY */}
          {assessmentResult.mode === 'read-aloud' && assessmentResult.wordsToPractice && assessmentResult.wordsToPractice.length > 0 && (
            <div className="p-5 rounded-2xl bg-orange-50/50 border border-orange-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-950 uppercase tracking-wider">
                  <RotateCcw className="w-4 h-4 text-orange-700" />
                  <span>CÁC TỪ CẦN LUYỆN THÊM (CHỌN ĐỂ THU ÂM LẠI TỪNG TỪ):</span>
                </div>
                <span className="text-[11px] text-slate-500">Tối đa 5 từ trọng tâm</span>
              </div>

              <div className="space-y-2.5">
                {assessmentResult.wordsToPractice.map((item: WordToPractice) => (
                  <div
                    key={item.word}
                    className="p-3.5 rounded-xl bg-white border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono text-sm flex items-center gap-2">
                        <span>{item.word}</span>
                        {item.status === 'improved' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-sans font-bold">
                            ✓ Đã tiến bộ
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 mt-0.5">{item.reasonVi}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => speakEnglish(item.word, speechRate)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Nghe mẫu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenWordRetry(item.word)}
                        className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Luyện lại từ này</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Single Word Retry Modal/Drawer */}
              {retryingWord && (
                <div className="p-4 rounded-2xl bg-white border-2 border-orange-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Đang luyện từ: <strong className="font-mono text-orange-700 text-sm">{retryingWord}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRetryingWord(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕ Đóng
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => speakEnglish(retryingWord, speechRate)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>1. Nghe mẫu</span>
                    </button>

                    {wordRecordState !== 'recording' ? (
                      <button
                        type="button"
                        onClick={handleStartWordRecording}
                        className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>2. Bấm thu âm từ này</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopWordRecording}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer animate-pulse"
                      >
                        <Square className="w-3.5 h-3.5 text-rose-400" />
                        <span>Dừng thu âm</span>
                      </button>
                    )}

                    {wordAudioBlob && wordRecordState !== 'recording' && (
                      <button
                        type="button"
                        onClick={handleAssessWord}
                        disabled={wordRecordState === 'assessing'}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {wordRecordState === 'assessing' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang chấm...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>3. Chấm từ này</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {wordFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        wordFeedback.status === 'good'
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                          : 'bg-amber-100 text-amber-950 border border-amber-300'
                      }`}
                    >
                      {wordFeedback.status === 'good' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                      )}
                      <span>{wordFeedback.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. ATTEMPT HISTORY ACCORDION */}
      {/* ---------------------------------------------------- */}
      {attempts.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-600" />
              <span>LỊCH SỬ LUYỆN TẬP BÀI NÀY ({attempts.length} lần theo chuẩn CEFR)</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2 pt-3 border-t border-slate-100 max-h-64 overflow-y-auto">
              {attempts.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>Lần {attempts.length - idx} &bull; {new Date(att.timestamp).toLocaleString('vi-VN')}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-200 text-slate-700">
                        {att.mode === 'speaking' ? 'Speaking' : 'Read Aloud'}
                      </span>
                      {att.cefrLevel && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${getCEFRBadge(att.cefrLevel).bg}`}>
                          {att.cefrLevel}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {att.mode === 'speaking' ? (
                        <span>Nói tự do theo câu hỏi &bull; Độ dễ hiểu: {att.intelligibilityScore || 85}%</span>
                      ) : (
                        <span>Phát âm: {att.pronunciationScore || 0}/40 &bull; Trôi chảy: {att.fluencyScore || 0}/25 &bull; Ngữ điệu: {att.intonationScore || 0}/20</span>
                      )}
                    </div>
                  </div>

                  <div className="text-base font-black text-amber-900 font-serif shrink-0">
                    {att.totalScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
