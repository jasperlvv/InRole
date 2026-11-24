"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import { resetDemoContent, restoreDemoContent } from "@/lib/demo-content";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";

export function DemoDataTools() {
  const { t } = useI18n();
  const [action, setAction] = useState<"reset" | "restore" | null>(null); const [error, setError] = useState(""); const { notify } = useUI();
  function perform() {
    try { if (action === "reset") resetDemoContent(); else restoreDemoContent(); setAction(null); notify(action === "reset" ? "已恢复初始示例，上一次内容已备份。" : "已恢复上次重置前的内容。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "操作失败，请重试。"); }
  }
  return <div className="demo-data-tools"><span>{t("本机演示工具")}</span><button onClick={() => { setError(""); setAction("reset"); }}>{t("重置示例内容")}</button><button onClick={() => { setError(""); setAction("restore"); }}>{t("恢复上次重置前内容")}</button>{action && <Modal title={action === "reset" ? t("重置本机演示内容？") : t("恢复上次重置前内容？")} onDismiss={() => setAction(null)}><p className="confirm-description">{action === "reset" ? t("本浏览器所有演示账号共享的帖子、评论、点赞、人物评价、投票、人物申请、通宝流水和举报记录会恢复为初始示例，现有内容会先备份。账号、喜好与未发布草稿保留。") : t("本浏览器所有演示账号共享的帖子、评论、点赞、人物评价、投票、人物申请、通宝流水和举报记录将替换成上次重置前的备份。账号、喜好与未发布草稿保留。")}</p>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<div className="confirm-actions"><button className="button button-outline" onClick={() => setAction(null)}>{t("取消")}</button><button className="button button-accent" onClick={perform}>{t("确认")}{action === "reset" ? t("重置") : t("恢复")}</button></div></Modal>}</div>;
}
