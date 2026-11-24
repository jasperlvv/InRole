"use client";

import Link from "next/link";
import { findPerson } from "@/lib/content-model";
import { portraitSources } from "@/lib/portrait-sources";
import { useI18n } from "@/lib/use-i18n";
import { PersonAvatar } from "./person-avatar";
import { Icon } from "./icon";

export function PortraitCredits() {
  const { t } = useI18n();
  return <section className="section-preview"><Link className="back-link" href="/people"><Icon name="back" size={17} />{t("人物剧场")}</Link><header className="page-heading"><div><p className="eyebrow">FACES BEHIND THE STORIES</p><h1>{t("头像来源")}<span className="heading-dot">.</span></h1><p>{t("感谢这些作品，让每个名字都有了面孔。")}</p></div></header><p className="section-note">{t("头像来自维基共享资源，已裁剪、缩放并转换为 WebP；每张图片沿用原图所列许可。历史画像与雕像为艺术表现。")}</p><ol className="portrait-credits-list">{portraitSources.map((source) => <li key={source.id}><PersonAvatar person={findPerson(source.id)!} large /><div><h2>{source.name}</h2><p>{source.author}</p><div><a href={source.sourcePage} target="_blank" rel="noreferrer">{t("原始作品")} ↗</a><a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a></div></div></li>)}</ol></section>;
}
