/** 管理者が保存する「問題生成用」タスク（API と管理画面で共有） */
export interface PendingTask {
  targetName: string;
  targetProfile: string;
  subject: string;
  title: string;
  rawText: string;
  savedAt: string;
}
