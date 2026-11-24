"use client";
import { useI18n } from "@/lib/use-i18n";

import { useState } from "react";
import Link from "next/link";
import { people, findPerson } from "@/lib/content-model";
import { useDemoContent } from "@/lib/demo-content";
import { useDemoSession } from "@/lib/demo-session";
import { PersonAvatar } from "./person-avatar";
import { Icon } from "./icon";

export function PersonPicker({ value, onChange, onRequest }: { value: string; onChange: (value: string) => void; onRequest?: () => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(!value);
  const [search, setSearch] = useState(""); const [category, setCategory] = useState("全部");
  const { state } = useDemoContent(); const { user } = useDemoSession();
  const person = findPerson(value);
  const categories = ["全部", ...new Set(people.map((item) => item.label))];
  const recentIds = user && Object.hasOwn(state.recentPeople, user.handle) ? state.recentPeople[user.handle] : [];
  const recent = recentIds.map(findPerson).filter((item) => item !== undefined);
  const visible = people.filter((item) => (category === "全部" || item.label === category) && `${item.name}${item.bio}`.includes(search.trim()));
  function select(id: string) { onChange(id); setExpanded(false); }
  return <section className="person-picker" aria-label={t("本次发言人物")}>
    <button type="button" className="selected-person" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{person ? <><PersonAvatar person={person} /><span><strong>{person.name}</strong><small>{t("本次扮演 · 点击更换")}</small></span></> : <><span className="person-placeholder"><Icon name="people" size={20} /></span><span><strong>{t("选择本次扮演的人物")}</strong><small>{t("每条发言都可以是新身份")}</small></span></>}<Icon name="chevron" size={17} /></button>
    {expanded && <div className="picker-panel"><label className="feed-search"><Icon name="search" size={16} /><span className="sr-only">{t("搜索扮演人物")}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜索人物名字或介绍")} /></label><div className="picker-categories">{categories.map((item) => <button type="button" key={item} aria-pressed={category === item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{t(item)}</button>)}</div>
      {!search && category === t("全部") && recent.length > 0 && <div className="recent-people"><p>{t("最近用过")}</p><div>{recent.map((item) => <button key={item.id} type="button" onClick={() => select(item.id)}>{item.name}</button>)}</div></div>}
      <div className="picker-people">{visible.map((item) => <button key={item.id} type="button" className={value === item.id ? "is-selected" : ""} aria-pressed={value === item.id} onClick={() => select(item.id)}><PersonAvatar person={item} /><span><strong>{item.name}</strong><small>{t(item.label)}</small></span>{value === item.id && <Icon name="check" size={15} />}</button>)}</div>{!visible.length && <p className="picker-empty">{t("没有找到这个人物，试试其他名字。")}</p>}
      <div className="picker-request"><span>{t("没有你想扮演的人物？")}</span><Link href="/people/request" onClick={onRequest}>{t("申请人物 ")}<Icon name="arrow" size={14} /></Link></div>
    </div>}
  </section>;
}
