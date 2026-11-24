"use client";
import { useI18n } from "@/lib/use-i18n";

import { useDemoContent } from "@/lib/demo-content";
export function ContentNotice() {
  const { t } = useI18n();
  const { error } = useDemoContent();
  return error ? <p className="form-alert" role="alert">{t(error)}</p> : null;
}
export function ContentLoading() {
  const { t } = useI18n(); return <div className="content-loading" role="status"><span />{t("正在准备这场好戏…")}</div>; }
