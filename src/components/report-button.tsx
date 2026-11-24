"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import { reportDemoContent } from "@/lib/demo-content";
import type { DemoReport } from "@/lib/content-model";
import { Modal } from "./modal";
import { useUI } from "./ui-provider";

export function ReportButton({ kind, targetId, next }: { kind: DemoReport["kind"]; targetId: string; next?: string }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("其他"); const [error, setError] = useState(""); const { ensureLogin, notify } = useUI();
  const label = language === "en" ? kind === "post" ? "post" : kind === "comment" ? "comment" : "review" : kind === "post" ? "帖子" : kind === "comment" ? "评论" : "评价";
  function save() { try { reportDemoContent(kind, targetId, reason); setOpen(false); notify("举报已记录在本机演示中，尚未发送至平台。"); } catch (issue) { setError(issue instanceof Error ? issue.message : "未能保存，请重试。"); } }
  return <><button className="report-button" aria-label={t(`举报这条${label}`)} onClick={() => { if (ensureLogin(next)) { setError(""); setOpen(true); } }}>{t("举报")}</button>{open && <Modal title={t(`举报这条${label}`)} onDismiss={() => setOpen(false)}><p className="confirm-description">{t("这是本机举报演示，记录不会发送给平台，也不会自动隐藏内容。")}</p><fieldset className="report-reasons"><legend>{t("请选择原因")}</legend>{["冒充或误导", "人身攻击", "垃圾广告", "其他"].map((item) => <label key={item}><input type="radio" name={`report-${targetId}`} checked={reason === item} onChange={() => setReason(item)} />{t(item)}</label>)}</fieldset>{t(error) && <p className="form-alert" role="alert">{t(error)}</p>}<button className="button button-accent auth-submit" onClick={save}>{t("保存演示举报")}</button></Modal>}</>;
}
