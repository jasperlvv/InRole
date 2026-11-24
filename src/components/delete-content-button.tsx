"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import { deleteDemoComment, deleteDemoPost } from "@/lib/demo-content";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";

export function DeleteContentButton({ id, kind }: { id: string; kind: "post" | "comment" }) {
  const { t, language } = useI18n();
  const [confirming, setConfirming] = useState(false); const [error, setError] = useState("");
  const { notify } = useUI(); const label = language === "en" ? kind === "post" ? "post" : "comment" : kind === "post" ? "帖子" : "评论";
  function remove() { try { if (kind === "post") deleteDemoPost(id); else deleteDemoComment(id); setConfirming(false); notify(`这条${label}已删除。`); } catch (issue) { setError(issue instanceof Error ? issue.message : "删除失败，请重试。"); } }
  return <><button className="delete-content-button" onClick={() => setConfirming(true)} aria-label={t(`删除自己的${label}`)}>{t("删除")}</button>{confirming && <Modal title={t(`删除这条${label}？`)} onDismiss={() => setConfirming(false)}><p className="confirm-description">{kind === "post" ? t("帖子下的评论和点赞也会一并移除。") : t("删除后，这条评论不再显示。")}{t("此操作只影响本机演示内容。")}</p>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<div className="confirm-actions"><button className="button button-outline" onClick={() => setConfirming(false)}>{t("保留")}{label}</button><button className="button button-danger" onClick={remove}>{t("确认删除")}</button></div></Modal>}</>;
}
