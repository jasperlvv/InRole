"use client";
import { useI18n } from "@/lib/use-i18n";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemoSession } from "@/lib/demo-session";
import { authHref } from "@/lib/account-rules";
import { Modal } from "./modal";
import { PostEditor } from "./post-editor";
import { Icon } from "./icon";
import { ensureDemoDailyCoins, ensureDemoSeedExpansion } from "@/lib/demo-content";

type ComposerOptions = { personId?: string; topicId?: string; quotePostId?: string };
type UIContextValue = { openComposer: (options?: ComposerOptions) => void; notify: (message: string) => void; ensureLogin: (next?: string) => boolean };
const UIContext = createContext<UIContextValue | null>(null);
export function UIProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [composer, setComposer] = useState<ComposerOptions | null>(null);
  const [toast, setToast] = useState("");
  const session = useDemoSession();
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => { ensureDemoSeedExpansion(); }, []);
  useEffect(() => {
    if (!session.user?.onboardingComplete) return;
    const claim = () => { try { ensureDemoDailyCoins(); } catch { /* The wallet offers an explicit retry and displays storage errors. */ } };
    claim(); window.addEventListener("focus", claim);
    return () => window.removeEventListener("focus", claim);
  }, [session.user?.handle, session.user?.onboardingComplete, pathname]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 5000); return () => window.clearTimeout(timer); }, [toast]);
  function ensureLogin(next = pathname) {
    if (!session.user) { router.push(authHref("/login", next)); return false; }
    if (!session.user.onboardingComplete) { router.push(authHref("/onboarding", next)); return false; }
    return true;
  }
  function openComposer(options: ComposerOptions = {}) { if (ensureLogin()) setComposer(options); }
  return <UIContext.Provider value={{ openComposer, notify: setToast, ensureLogin }}>{children}
    {composer && session.user && <Modal title={t("写一条开场白")} wide onDismiss={() => setComposer(null)}><PostEditor mode="post" onRequestPerson={() => setComposer(null)} initialPersonId={composer.personId} initialTopicId={composer.topicId} initialQuotePostId={composer.quotePostId} onPublished={(id, personName) => { setComposer(null); setToast(`已以${personName}的身份发布，帖子已保存在本机。`); router.push(`/posts/${id}`); }} /></Modal>}
    {t(toast) && <div className="feedback-toast" role="status"><Icon name="check" size={18} /><span>{t(toast)}</span><button className="icon-button" onClick={() => setToast("")} aria-label={t("关闭提示")}><Icon name="close" size={16} /></button></div>}
  </UIContext.Provider>;
}
export function useUI() { const value = useContext(UIContext); if (!value) throw new Error("UIProvider is missing."); return value; }
