"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { PageInfo, PersonDTO } from "@/lib/api-types";
import { authEnvelope, authRequest } from "@/data/auth-api";
import { FigureAvatar } from "./live-stage";
import { Failure } from "./live-shared";
import { Icon } from "./icon";
import s from "./live-person-picker.module.css";

export function LivePersonPicker({ value, onChange, label = "本次扮演人物", recentIds = [], disabled = false }: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  recentIds?: string[];
  disabled?: boolean;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(!value), [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(""), [version, setVersion] = useState(0);
  const [items, setItems] = useState<PersonDTO[]>([]), [page, setPage] = useState<PageInfo>();
  const [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<PersonDTO | null>(null), [selectedError, setSelectedError] = useState<unknown>(null);
  const query = search.trim();

  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    void authRequest<PersonDTO>(`/api/v1/people/${encodeURIComponent(value)}`, "GET", undefined, controller.signal)
      .then(person => { if (!controller.signal.aborted) { setSelected(person); setSelectedError(null); } })
      .catch(error => { if (!controller.signal.aborted) setSelectedError(error); });
    return () => controller.abort();
  }, [value, version]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams({ limit: "24", ...(query ? { q: query } : {}), ...(cursor ? { cursor } : {}) });
      void authEnvelope<PersonDTO[]>(`/api/v1/people?${parameters}`, "GET", undefined, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          setItems(previous => cursor ? [...previous, ...result.data.filter(person => !previous.some(item => item.id === person.id))] : result.data);
          setPage(result.meta.page); setError(null); setLoading(false);
        })
        .catch(error => { if (!controller.signal.aborted) { setError(error); setLoading(false); } });
    }, query ? 250 : 0);
    const retry = () => { setLoading(true); setVersion(v => v + 1); };
    window.addEventListener("online", retry); window.addEventListener("inrole:retry", retry);
    return () => { window.clearTimeout(timer); controller.abort(); window.removeEventListener("online", retry); window.removeEventListener("inrole:retry", retry); };
  }, [query, cursor, version]);

  const person = selected?.id === value ? selected : items.find(item => item.id === value);
  const visible = query ? items : [...items].sort((a, b) => Number(recentIds.includes(b.id)) - Number(recentIds.includes(a.id)));
  return <section className={s.picker} aria-labelledby={`${id}-label`} onKeyDown={event => {
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); trigger.current?.focus(); }
  }}>
    <span id={`${id}-label`} className={s.label}>{label}</span>
    <button ref={trigger} className={s.trigger} type="button" disabled={disabled} aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={() => setExpanded(!expanded)}>
      {person ? <FigureAvatar key={`${person.id}:${person.avatarUrl}`} person={person} /> : <span className={s.placeholder}><Icon name="people" size={22} /></span>}
      <span className={s.identity}><strong>{person?.name || "选择本次扮演的人物"}</strong><small>{person ? "本次扮演 · 点击更换" : "每条发言，都可以换个身份"}</small></span>
      <Icon name="chevron" size={18} />
    </button>
    <Failure error={selectedError} />
    {expanded && <div id={`${id}-panel`} className={s.panel}>
      <div className={s.search}>
        <Icon name="search" size={19} />
        <label className="sr-only" htmlFor={`${id}-search`}>搜索扮演人物</label>
        <input id={`${id}-search`} type="search" placeholder="搜索人物名字、别名或介绍" maxLength={80} value={search} disabled={disabled} onKeyDown={event => {
          if (event.key === "Enter") event.preventDefault();
        }} onChange={event => {
          const next = event.target.value;
          if (next.trim() !== query) { setCursor(""); setItems([]); setPage(undefined); setLoading(true); setError(null); }
          setSearch(next);
        }} />
      </div>
      <p className={s.hint}>{query ? `搜索“${query}”` : "选择一位人物，替 TA 说两句。"}</p>
      <Failure error={error} />
      {Boolean(error) && <button type="button" className={s.more} disabled={disabled || loading} onClick={() => { setLoading(true); setVersion(v => v + 1); }}>重新加载人物</button>}
      <div className={s.grid} role="group" aria-label="可选人物" aria-busy={loading}>
        {visible.map(item => <button type="button" className={s.option} key={item.id} disabled={disabled || loading} aria-pressed={value === item.id} onClick={() => {
          setSelected(item); setSelectedError(null); onChange(item.id); setExpanded(false); trigger.current?.focus();
        }}>
          <FigureAvatar key={`${item.id}:${item.avatarUrl}`} person={item} />
          <span className={s.identity}><strong>{item.name}</strong><small>{recentIds.includes(item.id) ? "最近使用 · " : ""}{item.interest.name}</small></span>
          {value === item.id && <Icon name="check" size={16} />}
        </button>)}
      </div>
      <div role="status" className={s.status}>{loading ? "正在寻找人物…" : !error && !items.length ? "没有找到匹配人物，试试其他名字，或申请 TA 登场。" : ""}</div>
      {page?.hasMore && !error && <button type="button" className={s.more} disabled={disabled || loading} onClick={() => { setLoading(true); setCursor(page.nextCursor || ""); }}>加载更多人物</button>}
    </div>}
    <div className={s.request}><Link href="/live/request">找不到？现在申请<Icon name="arrow" size={13} /></Link></div>
  </section>;
}
