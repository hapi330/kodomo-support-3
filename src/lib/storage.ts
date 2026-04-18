// LocalStorage utilities for persistent data

export interface StudyRecord {
  id: string;
  date: string;
  subject: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // seconds
  /** BGMルーレットによる経験値倍率（未設定時は 1.0） */
  xpMultiplier?: number;
  /** セッションBGMサイクル（分） */
  bgmCycleMinutes?: 5 | 7 | 9;
}

export interface StudySession {
  id: string;
  date: string;
  duration: number; // minutes
  xpEarned: number;
  questionsAnswered: number;
  correctCount: number;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "juku" | "dance" | "event" | "other";
  startTime?: string;
  endTime?: string;
  color: string;
}

export interface ChoreItem {
  id: string;
  title: string;
  points: number;
  completed: boolean;
  completedDate?: string;
  icon: string;
}

export interface AppState {
  totalXP: number;
  level: number;
  streak: number;
  lastStudyDate: string;
  studyRecords: StudyRecord[];
  studySessions: StudySession[];
  calendarEvents: CalendarEvent[];
  chores: ChoreItem[];
  uploadedContent: UploadedContent[];
  timetable: TimetableEntry[];
  settings: AppSettings;
}

export interface UploadedContent {
  id: string;
  title: string;
  subject: string;
  rawText: string;
  editedText: string;
  uploadDate: string;
  questions: GeneratedQuestion[];
  /** 1周クリア済み（2周目以降は完了時 +100 XP なし。編集で解除可能） */
  studyCleared?: boolean;
}

export interface GeneratedQuestion {
  id: string;
  /** 問題文（漢字あり） */
  question: string;
  /** 問題文のふりがな（読み上げ・表示用） */
  questionFurigana?: string;
  /** 正解 */
  answer: string;
  /** 正解のふりがな */
  answerFurigana?: string;
  /** 3段階ヒント（やさしい順） */
  hints: string[];
  /** 3択の選択肢 */
  choices: string[];
  /** 正解インデックス (0/1/2) */
  correctIndex: number;
  timesAnswered: number;
  timesCorrect: number;
  lastAnswered?: string;
  nextReviewDate?: string;
  /** 編集画面で追加・途中挿入した問題（見出しに「差し込み」と番号を付ける） */
  editorInserted?: boolean;
}

export interface TimetableEntry {
  day: number; // 0=Mon, 4=Fri
  period: number; // 1-6
  subject: string;
  teacher?: string;
}

export interface AppSettings {
  childName: string;
  adminPassword: string;
  soundEnabled: boolean;
  speechEnabled: boolean;
  timerDuration: number; // minutes before homework
}

const DEFAULT_STATE: AppState = {
  totalXP: 0,
  level: 1,
  streak: 0,
  lastStudyDate: "",
  studyRecords: [],
  studySessions: [],
  calendarEvents: [
    { id: "1", date: getThisWeekDate(1), title: "塾", type: "juku", startTime: "18:00", endTime: "20:00", color: "#4ade80" },
    { id: "2", date: getThisWeekDate(3), title: "ダンス", type: "dance", startTime: "17:00", endTime: "18:30", color: "#a78bfa" },
    { id: "3", date: getThisWeekDate(4), title: "塾", type: "juku", startTime: "18:00", endTime: "20:00", color: "#4ade80" },
  ],
  chores: [
    { id: "1", title: "おふろそうじ", points: 20, completed: false, icon: "🛁" },
    { id: "2", title: "ごはんのしたく", points: 15, completed: false, icon: "🍚" },
    { id: "3", title: "そうじき", points: 25, completed: false, icon: "🧹" },
    { id: "4", title: "ゴミだし", points: 10, completed: false, icon: "🗑️" },
    { id: "5", title: "あらいもの", points: 15, completed: false, icon: "🍽️" },
  ],
  uploadedContent: [],
  timetable: [
    { day: 0, period: 1, subject: "こくご" },
    { day: 0, period: 2, subject: "さんすう" },
    { day: 0, period: 3, subject: "りか" },
    { day: 0, period: 4, subject: "しゃかい" },
    { day: 0, period: 5, subject: "ずこう" },
    { day: 1, period: 1, subject: "さんすう" },
    { day: 1, period: 2, subject: "こくご" },
    { day: 1, period: 3, subject: "たいいく" },
    { day: 1, period: 4, subject: "おんがく" },
    { day: 1, period: 5, subject: "がいこくご" },
    { day: 2, period: 1, subject: "こくご" },
    { day: 2, period: 2, subject: "りか" },
    { day: 2, period: 3, subject: "さんすう" },
    { day: 2, period: 4, subject: "しゃかい" },
    { day: 2, period: 5, subject: "たいいく" },
    { day: 2, period: 6, subject: "そうごう" },
    { day: 3, period: 1, subject: "りか" },
    { day: 3, period: 2, subject: "こくご" },
    { day: 3, period: 3, subject: "がいこくご" },
    { day: 3, period: 4, subject: "さんすう" },
    { day: 3, period: 5, subject: "しゃかい" },
    { day: 4, period: 1, subject: "がいこくご" },
    { day: 4, period: 2, subject: "こくご" },
    { day: 4, period: 3, subject: "さんすう" },
    { day: 4, period: 4, subject: "りか" },
    { day: 4, period: 5, subject: "たいいく" },
  ],
  settings: {
    childName: "かんた",
    adminPassword: "1234",
    soundEnabled: true,
    speechEnabled: true,
    timerDuration: 10,
  },
};

function getThisWeekDate(dayOfWeek: number): string {
  const today = new Date();
  const curr = new Date(today);
  const day = curr.getDay();
  const diff = curr.getDate() - day + (day === 0 ? -6 : 1) + dayOfWeek;
  curr.setDate(diff);
  return curr.toISOString().split("T")[0];
}

const STORAGE_KEY = "kodomo-support-3";

export function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const saved = JSON.parse(raw) as Partial<AppState>;
    return { ...DEFAULT_STATE, ...saved };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

/** アプリ起動時: 読み込み → 連続記録の更新 → 保存（クライアントの useLayoutEffect から呼ぶ） */
export function initializeAppState(): AppState {
  const loaded = loadState();
  const updated = updateStreak(loaded);
  saveState(updated);
  return updated;
}

export function calcLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForNextLevel(level: number): number {
  return (level * level) * 50;
}

export function xpForCurrentLevel(level: number): number {
  return ((level - 1) * (level - 1)) * 50;
}

export function updateStreak(state: AppState): AppState {
  const today = new Date().toISOString().split("T")[0];
  if (state.lastStudyDate === today) return state;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const newStreak = state.lastStudyDate === yesterday ? state.streak + 1 : 1;
  return { ...state, streak: newStreak, lastStudyDate: today };
}
