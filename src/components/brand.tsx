"use client";
import { useI18n } from "@/lib/use-i18n";
import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false, href = "/demo" }: { compact?: boolean; href?: string }) {
  const { t } = useI18n();
  return <Link href={href} className={`brand ${compact ? "brand-compact" : ""}`} aria-label={t("入戏 InRole 首页")}><Image src="/brand/inrole-logo-v2.jpg" alt="" width={64} height={64} className="brand-image" /><span className="brand-wordmark">InRole<span>{t("入戏 · 换个身份，说你的话")}</span></span></Link>;
}
