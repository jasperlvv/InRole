"use client";
import { useI18n } from "@/lib/use-i18n";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

export function Modal({ title, children, onDismiss, wide = false }: { title: string; children: React.ReactNode; onDismiss: () => void; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`stage-dialog ${wide ? "dialog-wide" : ""}`} aria-label={t(title)} onCancel={(event) => { event.preventDefault(); onDismiss(); }} onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}>
    <div className="dialog-inner"><header className="dialog-heading"><h2>{t(title)}</h2><button type="button" className="icon-button" aria-label={t(`关闭${title}`)} onClick={onDismiss}><Icon name="close" /></button></header>{children}</div>
  </dialog>;
}
