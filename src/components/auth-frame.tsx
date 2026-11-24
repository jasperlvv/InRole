"use client";
import { useI18n } from "@/lib/use-i18n";
import Link from "next/link";
import { Brand } from "./brand";
import { Icon } from "./icon";
export function AuthFrame({ children, onboarding = false }: { children: React.ReactNode; onboarding?: boolean }) {
  const { t } = useI18n();
  return <div className={`auth-page ${onboarding ? "onboarding-page" : ""}`}><a className="skip-link" href="#main">{t("跳到主要内容")}</a><header className="auth-header"><Brand /><Link href="/" className="browse-link"><Icon name="back" size={17} /> {t(" 先逛逛广场")}</Link></header><main id="main" className="auth-layout"><aside className="auth-story"><p className="eyebrow">STEP INTO ANOTHER STORY</p><h2>{t("一人千面，")}<br />{t("万种可能")}<span>。</span></h2><p className="auth-story-text">{t("不必成为谁，")}<br />{t("也能拥有他的开场白。")}</p><div className="auth-art" aria-hidden="true"><span className="art-orbit" /><span className="art-person art-one">秦</span><span className="art-person art-two">白</span><span className="art-person art-three">悟</span><span className="art-spark">✳</span><span className="art-caption">{t("今天，想以谁的身份入戏？")}</span></div><p className="auth-story-bottom">{t("人物是大家的，想法是你的。")}</p></aside><div className="auth-form-column">{children}</div></main><footer className="auth-footer"><span>{t("入戏 InRole · 换个身份，说你的话。")}</span><span>{t("前端演示 · 非真实账号系统")}</span></footer></div>;
}
