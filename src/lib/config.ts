// アプリ全体で使う設定定数

export interface SubjectConfig {
  key: string;
  label: string;
  /** Minecraft風アイコン（学習画面・管理画面で使用） */
  mcIcon: string;
  /** テーマカラー */
  color: string;
}

export const SUBJECTS: SubjectConfig[] = [
  { key: "こくご",   label: "こくご",   mcIcon: "📖", color: "#3B82F6" },  // エンチャント本
  { key: "さんすう", label: "さんすう", mcIcon: "⚒️", color: "#10B981" },  // 工作台
  { key: "りか",     label: "りか",     mcIcon: "🧪", color: "#8B5CF6" },  // ポーション
  { key: "しゃかい", label: "しゃかい", mcIcon: "🗺️", color: "#F59E0B" },  // 地図
  { key: "その他",   label: "その他",   mcIcon: "📦", color: "#9CA3AF" },  // チェスト
];

/** キーで科目を引く。旧表記・廃止科目もフォールバック対応 */
export function getSubject(key: string): SubjectConfig {
  const aliases: Record<string, string> = {
    "がいこくご": "その他",
    "えいご":     "その他",
    "せいかつ":   "その他",
    "ずこう":     "その他",
    "おんがく":   "その他",
    "たいいく":   "その他",
    "そうごう":   "その他",
  };
  const normalized = aliases[key] ?? key;
  return SUBJECTS.find((s) => s.key === normalized) ?? SUBJECTS[SUBJECTS.length - 1];
}

/** 対象者プロファイルのデフォルト（問題生成時の参考情報） */
export const DEFAULT_LEARNER_PROFILE =
  "ASD・読み書き学習障害のある小学6年生。漢字の読み書きが苦手。視覚的サポートと段階的ヒントが有効。";
