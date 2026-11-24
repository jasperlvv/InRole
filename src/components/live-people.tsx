"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApiRequestError, databasePeopleReader } from "@/data/people-api";
import type { PersonDTO, PageInfo } from "@/lib/api-types";
import styles from "./live-people.module.css";

export function LivePeople() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PersonDTO[]>([]);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const currentRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (q: string, cursor?: string) => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setStatus("loading"); setError(null);
    if (!cursor) { setItems([]); setPage(null); }
    try {
      const result = await databasePeopleReader.list({ q, cursor, signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems(previous => cursor ? [...previous, ...result.items] : result.items);
      setPage(result.page); setStatus("ready");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setItems([]); setPage(null); setStatus("error");
      setError(failure instanceof ApiRequestError ? { message: failure.message, requestId: failure.requestId } : { message: "加载失败，请重试。" });
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    currentRequest.current = controller;
    void databasePeopleReader.list({ signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setItems(result.items); setPage(result.page); setStatus("ready");
    }).catch(failure => {
      if (controller.signal.aborted) return;
      setError(failure instanceof ApiRequestError ? { message: failure.message, requestId: failure.requestId } : { message: "加载失败，请重试。" });
      setStatus("error");
    });
    return () => controller.abort();
  }, []);
  return <div className={styles.screen}>
    <header className={styles.header}><Link href="/live/people" className={styles.brand}><Image src="/brand/inrole-logo-v2.jpg" width={52} height={52} alt="" /><strong>InRole <span>入戏</span></strong></Link><Link href="/demo">演示预览 ↗</Link></header>
    <main id="main" className={styles.main}>
      <div className={styles.eyebrow}>人物剧场</div><h1>今天，想遇见谁？</h1>
      <p className={styles.intro}>浏览公共人物，发现下一次发言的灵感。</p>
      <div className={styles.notice}><strong>真实数据预览</strong><span>人物来自开发数据库。发帖、登录等功能可在演示预览中体验。</span></div>
      <form className={styles.search} onSubmit={event => { event.preventDefault(); const value = term.trim(); setQuery(value); void load(value); }}>
        <label htmlFor="live-person-search" className="sr-only">搜索人物</label><input id="live-person-search" type="search" maxLength={80} value={term} onChange={event => setTerm(event.target.value)} placeholder="搜索姓名、别名或简介" /><button className="button button-accent" type="submit" disabled={status === "loading"}>搜索</button>
      </form>
      {status === "loading" && <p className={styles.state} role="status">正在加载人物…</p>}
      {status === "error" && <div className={styles.state} role="alert"><h2>人物暂时无法加载</h2><p>{error?.message}</p><button className="button button-outline" onClick={() => void load(query)}>重新加载</button>{error?.requestId && <small>反馈编号：{error.requestId}</small>}</div>}
      {status === "ready" && items.length === 0 && <div className={styles.state} role="status"><h2>{query ? "没有找到匹配的人物" : "人物库还在准备中"}</h2><p>{query ? "试试其他姓名或关键词。" : "公共人物添加后会出现在这里。"}</p></div>}
      {items.length > 0 && <ul className={styles.grid}>{items.map(person => <li className={styles.card} key={person.id}>
        {person.avatarUrl ? <Image className={styles.avatar} src={person.avatarUrl} width={76} height={76} alt="" /> : <span className={styles.placeholder} aria-hidden="true">{person.name.slice(0, 1)}</span>}
        <span className={styles.tag}>{person.interest.name}</span><h2>{person.name}</h2><p>{person.bio}</p>{person.aliases.length > 0 && <small>也称：{person.aliases.join("、")}</small>}
      </li>)}</ul>}
      {status === "ready" && page?.hasMore && <div className={styles.more}><button className="button button-outline" onClick={() => void load(query, page.nextCursor!)}>加载更多人物</button></div>}
      <footer className={styles.footer}><Link href="/people/credits">头像来源与署名</Link><span>游客可浏览 · 互动功能逐步接入</span></footer>
    </main>
  </div>;
}
