"use client";
import { useI18n } from "@/lib/use-i18n";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeDemoOnboarding, interests, useDemoSession } from "@/lib/demo-session";
import { authHref } from "@/lib/account-rules";
import { Icon } from "./icon";

export function OnboardingForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { ready, user } = useDemoSession();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  useEffect(() => { if (!ready) return; if (!user) router.replace(authHref("/login", next)); else if (user.onboardingComplete) router.replace(next); }, [ready, user, router, next]);
  function finish(skip = false) { if (!user || pending) return; completeDemoOnboarding(skip ? [] : selected); setPending(true); }
  if (!ready || !user || user.onboardingComplete) return <div className="auth-loading" role="status">{t("正在准备你的舞台…")}</div>;
  return <section className="auth-form-card onboarding-card" aria-labelledby="onboarding-title"><div className="demo-pill"><span /> {t(" 前端演示体验")}</div><p className="auth-step">{t("02 / 挑选你的灵感")}</p><h1 id="onboarding-title">{t("哪一种故事，")}<br />{t("让你想接下一句？")}</h1><p className="auth-subtitle">{t("你好，@")}{user.handle}{t("。选 1～5 个喜好，为以后的推荐留点线索。")}</p>
    <div className="interest-grid" aria-label={t("选择你的喜好")}>{interests.map((interest) => { const checked = selected.includes(interest.id); const disabled = !checked && selected.length >= 5; return <label className={`interest-option ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`} key={interest.id}><input type="checkbox" checked={checked} disabled={disabled || pending} onChange={() => setSelected(checked ? selected.filter((id) => id !== interest.id) : [...selected, interest.id])} /><span className="interest-symbol" aria-hidden="true">{interest.symbol}</span><strong>{t(interest.label)}</strong><small>{t(interest.description)}</small><span className="interest-check" aria-hidden="true">{checked && <Icon name="check" size={12} />}</span></label>; })}</div>
    <p className="selection-count" aria-live="polite">{t("已选择 ")}<strong>{selected.length}</strong> / 5 <span>{selected.length === 5 ? t("已选满，可取消后更换") : t("这只是喜好，不会限定你扮演谁")}</span></p><button className="button button-accent auth-submit" disabled={selected.length === 0 || pending} onClick={() => finish()}>{pending ? t("正在入戏…") : t("选好了，进入广场")}<Icon name="arrow" size={18} /></button><button className="skip-onboarding" disabled={pending} onClick={() => finish(true)}>{t("暂时跳过，先随便逛逛")}</button><p className="onboarding-note">{t("喜好仅保存在本机；个性化推荐将在后续开放。")}<br />{t("你始终可以自由选择任何人物。")}</p></section>;
}
