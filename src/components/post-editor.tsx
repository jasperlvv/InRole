"use client";
import { useI18n } from "@/lib/use-i18n";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useDemoSession } from "@/lib/demo-session";
import { createDemoComment, createDemoPost, readDraft, saveDraft, useDemoContent } from "@/lib/demo-content";
import { characterCount, findPerson, topics, type Draft } from "@/lib/content-model";
import { PersonPicker } from "./person-picker";
import { IMAGE_TYPES, VIDEO_TYPES, normalizePoll, validateAttachments, type PollDraft } from "@/lib/post-rules";
import { readLocalMedia, saveLocalMedia } from "@/lib/media-store";
import { LocalMedia } from "./local-media";
import { QuotedPost } from "./quoted-post";
import { Icon } from "./icon";

export function PostEditor({ mode, postId, initialPersonId, initialTopicId, initialQuotePostId, onRequestPerson, onPublished }: { mode: "post" | "comment"; postId?: string; initialPersonId?: string; initialTopicId?: string; initialQuotePostId?: string; onRequestPerson?: () => void; onPublished: (id: string, personName: string) => void }) {
  const { t } = useI18n();
  const { user } = useDemoSession(); const { state } = useDemoContent();
  const key = `${user?.handle ?? "guest"}:${mode}:${postId ?? "new"}`;
  const [draft, setDraft] = useState<Draft>(() => { const saved = readDraft(key); return { ...saved, personId: initialPersonId ?? saved.personId, topicIds: initialTopicId ? [...new Set([...saved.topicIds, initialTopicId])].slice(0, 3) : saved.topicIds, quotePostId: initialQuotePostId ?? saved.quotePostId }; });
  const latest = useRef(draft); const imageInput = useRef<HTMLInputElement>(null); const videoInput = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false); const [quotePicker, setQuotePicker] = useState(false); const [quoteSearch, setQuoteSearch] = useState("");
  const [error, setError] = useState(""); const [draftError, setDraftError] = useState(""); const [pending, setPending] = useState(false);
  const locked = useRef(false); const request = useRef<string | null>(null);
  const person = findPerson(draft.personId); const count = characterCount(draft.body);
  const attachments = draft.attachments ?? [];
  let pollIssue = ""; if (draft.poll) { try { normalizePoll(draft.poll); } catch (issue) { pollIssue = issue instanceof Error ? issue.message : "请完善投票。"; } }
  const hasContent = Boolean(draft.body.trim() || (mode === "post" && (attachments.length || draft.poll || draft.quotePostId)));
  function update(patch: Partial<Draft>) { const next = { ...latest.current, ...patch }; latest.current = next; setDraft(next); setError(""); setDraftError(saveDraft(key, next) ?? ""); }
  function updatePoll(patch: Partial<PollDraft>) { if (draft.poll) update({ poll: { ...draft.poll, ...patch } }); }
  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = ""; if (!files.length) return;
    setError(""); setAttaching(true);
    try {
      validateAttachments([...attachments, ...files.map((file) => ({ id: crypto.randomUUID(), name: file.name, mime: file.type, size: file.size, kind: file.type.startsWith("video/") ? "video" as const : "image" as const }))]);
      const saved = await Promise.all(files.map(saveLocalMedia)); update({ attachments: [...attachments, ...saved] });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "附件没有保存，请重试。"); }
    finally { setAttaching(false); }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || attaching || !user || !person) return;
    locked.current = true; setPending(true); setError(""); request.current ??= crypto.randomUUID();
    try {
      if (mode === "post") await Promise.all(attachments.map((item) => readLocalMedia(item.id)));
      const id = mode === "post" ? createDemoPost(draft, request.current) : createDemoComment(postId!, draft, request.current);
      saveDraft(key, null); request.current = null; const empty = { personId: "", body: "", topicIds: [] }; latest.current = empty; setDraft(empty);
      onPublished(id, person.name);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "保存失败，请保留草稿后重试。"); }
    finally { locked.current = false; setPending(false); }
  }
  const quoteResults = state.posts.filter((post) => `${post.body}${findPerson(post.personId)?.name}${post.handle}`.toLowerCase().includes(quoteSearch.toLowerCase().trim())).slice(0, 6);
  return <form className={`post-editor ${mode === "comment" ? "comment-editor" : ""}`} onSubmit={(event) => void publish(event)} aria-busy={pending || attaching}><fieldset className="editor-fields" disabled={pending}>
    <p className="editor-intro">{mode === "post" ? t("选个身份，让这出戏从你开始。") : t("换个人物，接上这一句。")}<span>{t("本机演示")}</span></p>
    <PersonPicker value={draft.personId} onChange={(personId) => update({ personId })} onRequest={onRequestPerson} />
    <label className="editor-label" htmlFor={`body-${mode}`}>{mode === "post" ? t("你的开场白") : t("你的评论")}<span>{person ? `${person.name} · @${user?.handle}` : t("先选人物，再说你的话")}</span></label>
    <textarea id={`body-${mode}`} value={draft.body} onChange={(event) => update({ body: event.target.value })} placeholder={mode === "post" ? t("说点什么，或用图片、视频、投票开场……") : t("用另一个身份，给故事一点新方向……")} rows={mode === "post" ? 4 : 3} aria-describedby={`count-${mode}`} />
    <div className="editor-counter" id={`count-${mode}`}><span>{t(draftError) || t("草稿随输入保存在本机")}</span><span className={count > 500 ? "over-limit" : ""}>{count} / 500</span></div>
    {mode === "post" && <>
      <div className="creation-toolbar" aria-label={t("添加帖子内容")}><button type="button" disabled={attaching} onClick={() => imageInput.current?.click()}><Icon name="image" size={18} />{t("图片")}</button><button type="button" disabled={attaching} onClick={() => videoInput.current?.click()}><Icon name="video" size={18} />{t("视频")}</button><button type="button" aria-pressed={Boolean(draft.poll)} onClick={() => update({ poll: draft.poll ? undefined : { question: "", options: ["", ""], durationHours: 24 } })}><Icon name="poll" size={18} />{t("投票")}</button><button type="button" aria-expanded={quotePicker} onClick={() => setQuotePicker(!quotePicker)}><Icon name="quote" size={18} />{t("引用")}</button><span>{attaching ? t("正在保存附件…") : t("让开场更有戏")}</span></div>
      <input className="sr-only" ref={imageInput} type="file" multiple accept={IMAGE_TYPES.join(",")} aria-label={t("添加图片附件")} onChange={(event) => void attach(event)} tabIndex={-1} />
      <input className="sr-only" ref={videoInput} type="file" accept={VIDEO_TYPES.join(",")} aria-label={t("添加视频附件")} onChange={(event) => void attach(event)} tabIndex={-1} />
      {attachments.length > 0 && <div className="attachment-previews">{attachments.map((item) => <figure key={item.id}><LocalMedia item={item} /><figcaption><span>{item.name}</span><button type="button" disabled={attaching} aria-label={t(`移除附件${item.name}`)} onClick={() => update({ attachments: attachments.filter((entry) => entry.id !== item.id) })}><Icon name="close" size={15} /></button></figcaption></figure>)}</div>}
      <p className="media-help">{t("最多 6 张图片（每张 5 MB），或 1 个视频（30 MB）。附件仅保存在这台浏览器。")}</p>
      {draft.poll && <section className="poll-editor" aria-label={t("编辑投票")}><div className="attachment-section-heading"><strong>{t("发起一个投票")}</strong><button type="button" onClick={() => update({ poll: undefined })}>{t("移除投票")}</button></div><label>{t("投票问题")}<input value={draft.poll.question} onChange={(event) => updatePoll({ question: event.target.value })} placeholder={t("如果你是秦始皇，周一会先做什么？")} /></label>{draft.poll.options.map((option, index) => <div className="poll-option-edit" key={index}><label>{t("选项 ")}{index + 1}<input value={option} onChange={(event) => updatePoll({ options: draft.poll!.options.map((item, position) => position === index ? event.target.value : item) })} placeholder={t(`输入选项 ${index + 1}`)} /></label>{draft.poll!.options.length > 2 && <button type="button" aria-label={t(`移除选项${index + 1}`)} onClick={() => updatePoll({ options: draft.poll!.options.filter((_, position) => position !== index) })}><Icon name="close" size={16} /></button>}</div>)}<div className="poll-editor-bottom"><button type="button" disabled={draft.poll.options.length >= 4} onClick={() => updatePoll({ options: [...draft.poll!.options, ""] })}>{t("＋ 添加选项")}</button><label>{t("投票时长")}<select value={draft.poll.durationHours} onChange={(event) => updatePoll({ durationHours: Number(event.target.value) as PollDraft["durationHours"] })}><option value={24}>{t("1 天")}</option><option value={72}>{t("3 天")}</option><option value={168}>{t("7 天")}</option></select></label></div><small className={pollIssue ? "poll-validation" : ""}>{pollIssue || t("单选 · 每账号一票 · 发布后不能修改选项")}</small></section>}
      {quotePicker && <section className="quote-picker" aria-label={t("选择引用帖子")}><label className="feed-search"><Icon name="search" size={16} /><span className="sr-only">{t("搜索要引用的帖子")}</span><input type="search" value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder={t("搜关键词、人物或作者")} /></label>{quoteResults.map((post) => <button key={post.id} type="button" onClick={() => { update({ quotePostId: post.id }); setQuotePicker(false); }}><strong>{findPerson(post.personId)?.name} · @{post.handle}</strong><span>{post.body || post.poll?.question || t("图片 / 视频帖子")}</span></button>)}{!quoteResults.length && <p>{t("没有找到匹配帖子。")}</p>}</section>}
      {draft.quotePostId && <div className="quote-editor"><div className="attachment-section-heading"><strong>{t("引用一出好戏")}</strong><button type="button" onClick={() => update({ quotePostId: undefined })}>{t("移除引用")}</button></div><QuotedPost postId={draft.quotePostId} /></div>}
      <fieldset className="editor-topics"><legend>{t("带上话题 ")}<span>{t("可选，最多 3 个")}</span></legend><div>{topics.map((topic) => { const checked = draft.topicIds.includes(topic.id); return <label className={checked ? "is-selected" : ""} key={topic.id}><input type="checkbox" checked={checked} disabled={!checked && draft.topicIds.length >= 3} onChange={() => update({ topicIds: checked ? draft.topicIds.filter((id) => id !== topic.id) : [...draft.topicIds, topic.id] })} /><span># {t(topic.name)}</span></label>; })}</div></fieldset>
    </>}
    {t(error) && <p className="form-alert" role="alert">{t(error)}</p>}
    <div className="editor-footer"><small>{t("人物可以借用，想法始终属于你。")}</small><button className="button button-accent" type="submit" disabled={pending || attaching || !person || !hasContent || characterCount(draft.body.trim()) > 500 || (mode === "post" && Boolean(pollIssue))}>{pending ? t("保存中…") : mode === "post" ? t("发布帖子") : t("发布评论")}<Icon name="arrow" size={16} /></button></div>
  </fieldset></form>;
}
