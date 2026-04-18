"use client";

import { useCallback, useEffect, useState } from "react";
import type { UploadedContent } from "@/lib/storage";
import { sortUploadedContentForStudyList } from "@/lib/study-content-sort";
import { hasPendingChoiceHintEnrichment } from "@/lib/inserted-enrichment-gate";
import {
  deleteProblemContent,
  enrichInsertedProblemsAfterSave,
  fetchProblems,
  saveProblemContent,
} from "@/lib/problems-client";

type QuestListCrudOptions = {
  /** パスワード確認後、編集フォームを開くとき */
  onEnterEditMode: () => void;
  /** 編集を閉じる・保存完了後 */
  onLeaveEditMode: () => void;
};

/**
 * 学習タブ「まなぶ」クエスト一覧の取得・編集・削除・パスワードゲート
 */
export function useStudyQuestListCrud(adminPassword: string, options: QuestListCrudOptions) {
  const { onEnterEditMode, onLeaveEditMode } = options;

  const [content, setContent] = useState<UploadedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [editDraft, setEditDraft] = useState<UploadedContent | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editAiEnrichBusy, setEditAiEnrichBusy] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editPasswordGate, setEditPasswordGate] = useState<UploadedContent | null>(null);
  const [editPasswordInput, setEditPasswordInput] = useState("");

  const refreshContent = useCallback(async () => {
    const data = await fetchProblems();
    setContent(sortUploadedContentForStudyList(data));
  }, []);

  useEffect(() => {
    refreshContent()
      .catch(() => setFetchError("問題データの読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [refreshContent]);

  const openEdit = useCallback(
    (c: UploadedContent) => {
      setEditDraft(structuredClone(c));
      onEnterEditMode();
    },
    [onEnterEditMode]
  );

  const requestEdit = useCallback((c: UploadedContent) => {
    setEditPasswordInput("");
    setEditPasswordGate(c);
  }, []);

  const submitEditPassword = useCallback(() => {
    if (!editPasswordGate) return;
    if (editPasswordInput === adminPassword) {
      openEdit(editPasswordGate);
      setEditPasswordGate(null);
      setEditPasswordInput("");
    } else {
      setEditPasswordInput("");
      alert("パスワードが違います");
    }
  }, [adminPassword, editPasswordGate, editPasswordInput, openEdit]);

  const cancelEditPassword = useCallback(() => {
    setEditPasswordGate(null);
    setEditPasswordInput("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditDraft(null);
    onLeaveEditMode();
  }, [onLeaveEditMode]);

  /** 現在の下書きを保存したうえでヒント・三択を AI 生成し、編集を続けたまま反映する */
  const alertEnrichFailures = useCallback((failures: { label: string; message: string }[]) => {
    if (failures.length === 0) return;
    const lines = failures.map((f) => `${f.label}: ${f.message}`).join("\n");
    window.alert(`次の問題で AI 生成に失敗しました。編集で内容を確認し、もう一度「ヒント・三択を AI で生成」を試してください。\n\n${lines}`);
  }, []);

  const runAiEnrichOnEditDraft = useCallback(async () => {
    if (!editDraft?.id) return;
    setEditAiEnrichBusy(true);
    try {
      await saveProblemContent(editDraft);
      const { enrichmentFailures } = await enrichInsertedProblemsAfterSave(editDraft.id);
      alertEnrichFailures(enrichmentFailures);
      const data = await fetchProblems();
      const next = data.find((c) => c.id === editDraft.id);
      if (next) setEditDraft(structuredClone(next));
      await refreshContent();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "ヒント・選択肢の自動生成に失敗しました（本文は保存済みの場合があります）"
      );
    } finally {
      setEditAiEnrichBusy(false);
    }
  }, [editDraft, refreshContent, alertEnrichFailures]);

  const saveEdit = useCallback(async () => {
    if (!editDraft?.id) return;
    setEditSaving(true);
    try {
      await saveProblemContent(editDraft);
      if (hasPendingChoiceHintEnrichment(editDraft)) {
        try {
          const { enrichmentFailures } = await enrichInsertedProblemsAfterSave(editDraft.id);
          alertEnrichFailures(enrichmentFailures);
        } catch (e) {
          alert(
            e instanceof Error
              ? `${e.message}（本文の保存は完了しています。編集画面の「ヒント・三択を AI で生成」で再試行できます）`
              : "ヒント・選択肢の自動生成に失敗しました（保存は完了しています）"
          );
        }
      }
      await refreshContent();
      setEditDraft(null);
      onLeaveEditMode();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setEditSaving(false);
    }
  }, [editDraft, onLeaveEditMode, refreshContent, alertEnrichFailures]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    setDeleteBusy(true);
    try {
      await deleteProblemContent(deleteConfirmId);
      setDeleteConfirmId(null);
      await refreshContent();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteConfirmId, refreshContent]);

  return {
    content,
    isLoading,
    fetchError,
    refreshContent,
    editDraft,
    setEditDraft,
    editSaving,
    deleteConfirmId,
    setDeleteConfirmId,
    deleteBusy,
    editPasswordGate,
    editPasswordInput,
    setEditPasswordInput,
    requestEdit,
    submitEditPassword,
    cancelEditPassword,
    cancelEdit,
    saveEdit,
    confirmDelete,
    runAiEnrichOnEditDraft,
    editAiEnrichBusy,
  };
}
