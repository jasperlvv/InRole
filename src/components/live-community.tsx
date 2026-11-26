"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PageInfo } from "@/lib/api-types";
import type { CatalogDTO, PreferencesDTO, PostDTO, CommentDTO, ImageDTO } from "@/lib/community-types";
import { authEnvelope, authRequest, readAccount } from "@/data/auth-api";
import { liveReturnTo } from "@/lib/live-auth-rules";
import { api, Failure, LiveShell, useResource } from "./live-shared";
import s from "./live-community.module.css";
import { StageFeed, StagePostCard, FigureAvatar, ReportDialog } from "./live-stage";
import { BlockButton } from "./live-controls";
import { StagePerson } from "./live-figures";
import { LivePersonPicker } from "./live-person-picker";

function useAction(reload?: () => void) {
  const [pending, setPending] = useState(false), [error, setError] = useState<unknown>(null), [notice, setNotice] = useState("");
  const busy = useRef(false);
  async function run(action: () => Promise<unknown>, success = "已保存。") {
    if (busy.current) return; busy.current = true; setPending(true); setError(null); setNotice("");
    try { await action(); setNotice(success); reload?.(); } catch (error) { setError(error); }
    finally { busy.current = false; setPending(false); }
  }
  return { pending, run, feedback: <><Failure error={error} />{notice && <p className={s.notice} role="status">{notice}</p>}</> };
}
export function LivePreferences({ onboarding = false, next = "/live" }: { onboarding?: boolean; next?: string }) {
  const prefs = useResource<PreferencesDTO>(api("preferences")), catalog = useResource<CatalogDTO>(api("catalog"));
  const [selection, setSelection] = useState<string[] | null>(null), router = useRouter(), action = useAction(prefs.reload);
  const selected = selection ?? prefs.data?.interestIds ?? [];
  async function save(finish: boolean, skip = false) {
    await action.run(async () => {
      await authRequest(api("preferences"), "PUT", { interestIds: skip ? [] : selected, finishOnboarding: finish });
      if (finish) router.replace(liveReturnTo(next));
    });
  }
  return <LiveShell><h1>{onboarding ? "让故事从你的喜好开始" : "我的喜好"}</h1><p>选择1～5项。喜好影响推荐，每次发言仍可自由选择人物。</p><Failure error={prefs.error || catalog.error} />{prefs.loading && <p role="status">正在读取喜好…</p>}{prefs.data && catalog.data && <><div className={s.chips}>{catalog.data.interests.map(tag => <label key={tag.id}><input type="checkbox" checked={selected.includes(tag.id)} disabled={action.pending || (!selected.includes(tag.id) && selected.length >= 5)} onChange={() => setSelection(selected.includes(tag.id) ? selected.filter(id => id !== tag.id) : [...selected, tag.id])} />{tag.name}</label>)}</div><p className={s.muted}>已选 {selected.length}/5；可先保存，稍后继续。</p>{action.feedback}<div className={s.row}><button className={s.primary} disabled={action.pending || selected.length === 0} onClick={() => void save(onboarding)}>保存{onboarding ? "并开始浏览" : "喜好"}</button>{onboarding && <><button disabled={action.pending} onClick={() => void save(false)}>暂存选择</button><button disabled={action.pending} onClick={() => void save(true, true)}>暂时跳过</button></>}</div></>}</LiveShell>;
}
function Identity({ person, author }: Pick<PostDTO, "person" | "author">) {
  return <div className={s.row}><FigureAvatar person={person} /><Link href={`/live/people/${person.id}`}><strong>{person.name}</strong></Link><Link href={`/live/users/${author.handle}`}>· @{author.handle}</Link><span className={s.muted}>用户扮演</span></div>;
}
export function LiveComposer({ quoteId = "", initialPersonId = "", onPublished }: { quoteId?: string; initialPersonId?: string; onPublished?: () => void }) {
  const catalog = useResource<CatalogDTO>(api("catalog")), prefs = useResource<PreferencesDTO>(api("preferences"));
  const [personId, setPerson] = useState(initialPersonId), [body, setBody] = useState(""), [topicIds, setTopics] = useState<string[]>([]), [media, setMedia] = useState<ImageDTO[]>([]), [pollQuestion, setPollQuestion] = useState(""), [pollOptions, setPollOptions] = useState(""), [duration, setDuration] = useState(1), [handle, setHandle] = useState("");
  const key = useRef({ payload: "", id: "" }), action = useAction(onPublished), router = useRouter();
  useEffect(() => {
    let active = true;
    void readAccount().then(account => { if (!active) return; setHandle(account.handle); try { const draft = JSON.parse(sessionStorage.getItem(`inrole.live.draft.${account.handle}`) || "null"); if (draft) { setBody(draft.body || ""); setPerson(initialPersonId || draft.personId || ""); setTopics(Array.isArray(draft.topicIds) ? draft.topicIds : []); setMedia(Array.isArray(draft.media) ? draft.media : []); setPollQuestion(draft.pollQuestion || ""); setPollOptions(draft.pollOptions || ""); setDuration([1,3,7].includes(draft.duration) ? draft.duration : 1); if (draft.key?.id && draft.key?.payload) key.current = draft.key; } } catch { /* Keep the editable in-memory draft. */ } }).catch(() => {});
    return () => { active = false; };
  }, [initialPersonId]);
  useEffect(() => { if (handle) { try { sessionStorage.setItem(`inrole.live.draft.${handle}`, JSON.stringify({ body, personId, topicIds, media, pollQuestion, pollOptions, duration, key: key.current })); } catch { /* Draft is still kept in the form after a failure. */ } } }, [handle, body, personId, topicIds, media, pollQuestion, pollOptions, duration]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!personId) return;
    const payload = { personId, body, topicIds, mediaIds: media.map(item => item.id), quotePostId: quoteId || null, poll: pollQuestion ? { question: pollQuestion, options: pollOptions.split("\n").map(v => v.trim()).filter(Boolean), durationDays: duration } : null };
    const serialized = JSON.stringify(payload); if (key.current.payload !== serialized) key.current = { payload: serialized, id: crypto.randomUUID() };
    if (handle) { try { sessionStorage.setItem(`inrole.live.draft.${handle}`, JSON.stringify({ body, personId, topicIds, media, pollQuestion, pollOptions, duration, key: key.current })); } catch { /* Keep the pending key in memory. */ } }
    await action.run(async () => {
      const result = await authRequest<{ id: string }>(api("posts"), "POST", payload, undefined, { "Idempotency-Key": key.current.id });
      setBody(""); setMedia([]); setPollQuestion(""); setPollOptions(""); key.current = { payload: "", id: "" };
      router.push(`/live/posts/${result.id}`);
    }, "发布成功。");
  }
  return <section className={s.card}><h2>{quoteId ? "引用这篇帖子" : "写一出新故事"}</h2><Failure error={catalog.error} />{!handle ? <p><Link href="/live/login?next=%2Flive">登录后发帖</Link></p> : <form onSubmit={submit}><LivePersonPicker value={personId} onChange={setPerson} recentIds={prefs.data?.recentPeople} disabled={action.pending} /><label>帖子正文<textarea rows={4} maxLength={1000} value={body} onChange={e => setBody(e.target.value)} placeholder="换个身份，说你的话（最多500字）" /></label><fieldset><legend>话题（最多3项）</legend><div className={s.chips}>{catalog.data?.topics.map(topic => <label key={topic.id}><input type="checkbox" checked={topicIds.includes(topic.id)} disabled={!topicIds.includes(topic.id) && topicIds.length >= 3} onChange={() => setTopics(topicIds.includes(topic.id) ? topicIds.filter(id => id !== topic.id) : [...topicIds, topic.id])} />{topic.name}</label>)}</div></fieldset><label>图片最多6张（每张5MB），或1个视频（30MB）<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" disabled={action.pending || (media.length >= 6 || media.some(item => item.kind === "video"))} onChange={e => { const file = e.target.files?.[0]; if (file) void action.run(async () => { const data = new FormData(); data.append("file", file); const item = await authRequest<ImageDTO>(api("media"), "POST", data); setMedia(previous => [...previous, item]); }, "图片已上传。"); e.target.value = ""; }} /></label><div className={s.row}>{media.map(item => <button key={item.id} type="button" onClick={() => setMedia(media.filter(value => value.id !== item.id))}>移除{item.kind === "video" ? "视频" : "图片"} {media.indexOf(item) + 1}</button>)}</div><details><summary>添加单选投票</summary><label>投票问题<input maxLength={100} value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} /></label><label>选项（2～4个，每行一个）<textarea rows={4} value={pollOptions} onChange={e => setPollOptions(e.target.value)} /></label><label>有效期<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value={1}>1天</option><option value={3}>3天</option><option value={7}>7天</option></select></label></details>{quoteId && <p>引用原帖：<Link href={`/live/posts/${quoteId}`}>查看原帖</Link></p>}{action.feedback}<button className={s.primary} disabled={action.pending || !personId} type="submit">{action.pending ? "处理中…" : "发布帖子"}</button></form>}</section>;
}
export function PostCard({ post, refresh }: { post: PostDTO; refresh: () => void }) { return <StagePostCard post={post} refresh={refresh} />; }
export function LiveFeed(props: { filter?: string; heading?: string; intro?: React.ReactNode }) { return <StageFeed {...props} />; }
export function LivePost({ id }: { id: string }) {
  const [reportComment, setReportComment] = useState<string | null>(null);
  const post = useResource<PostDTO>(api(`posts/${id}`));
  const [comments, setComments] = useState<CommentDTO[]>([]), [page, setPage] = useState<PageInfo | undefined>(), [commentError, setCommentError] = useState<unknown>(null), [version, setVersion] = useState(0), [open, setOpen] = useState(false), [personId, setPerson] = useState(""), [body, setBody] = useState("");
  const key = useRef({ payload: "", id: "" }), action = useAction(() => { post.reload(); setVersion(v => v + 1); });
  useEffect(() => { const controller = new AbortController(); void authEnvelope<CommentDTO[]>(api(`posts/${id}/comments`), "GET", undefined, controller.signal).then(result => { if (!controller.signal.aborted) { setComments(result.data); setPage(result.meta.page); setCommentError(null); } }).catch(error => { if (!controller.signal.aborted) { setComments([]); setCommentError(error); } }); const retry = () => setVersion(v => v + 1); window.addEventListener("inrole:retry", retry); window.addEventListener("online", retry); return () => { controller.abort(); window.removeEventListener("inrole:retry", retry); window.removeEventListener("online", retry); }; }, [id, version]);
  async function more() { if (!page?.nextCursor) return; try { const result = await authEnvelope<CommentDTO[]>(api(`posts/${id}/comments?cursor=${encodeURIComponent(page.nextCursor!)}`)); setComments(previous => [...previous, ...result.data]); setPage(result.meta.page); } catch (error) { setCommentError(error); } }
  return <LiveShell><h1>这一出戏</h1><Failure error={post.error} />{post.loading && <p role="status">正在加载帖子…</p>}{post.data && <><PostCard post={post.data} refresh={post.reload} /><section className={s.card}><h2>接着说</h2><Failure error={commentError} />{comments.map(comment => <article className={s.card} key={comment.id}><Identity person={comment.person} author={comment.author} /><p className={s.body}>{comment.body}</p>{comment.mine && <button disabled={action.pending} onClick={() => void action.run(() => authRequest(api(`comments/${comment.id}`), "DELETE", {}), "评论已删除。")}>删除评论</button>}{!comment.mine && <BlockButton handle={comment.author.handle} />} {!comment.mine && <button className="text-action" onClick={() => setReportComment(comment.id)}>举报评论</button>}</article>)}{page?.hasMore && <button disabled={action.pending} onClick={() => void more()}>更多评论</button>}{!commentError && comments.length === 0 && <p>还没有评论，来接第一句。</p>}<button aria-expanded={open} onClick={() => setOpen(!open)}>写评论</button>{open && <form onSubmit={e => { e.preventDefault(); if (!personId) return; const payload = JSON.stringify({ personId, body }); if (key.current.payload !== payload) key.current = { payload, id: crypto.randomUUID() }; void action.run(async () => { await authRequest(api(`posts/${id}/comments`), "POST", { personId, body }, undefined, { "Idempotency-Key": key.current.id }); setBody(""); setOpen(false); key.current = { payload: "", id: "" }; }, "评论已发布。"); }}><LivePersonPicker value={personId} onChange={setPerson} label="评论时扮演的人物" disabled={action.pending} /><label>评论内容<textarea required rows={3} value={body} onChange={e => setBody(e.target.value)} /></label><button className={s.primary} disabled={action.pending || !personId}>发布评论</button></form>}{action.feedback}</section></>}{reportComment && <ReportDialog kind="comment" targetId={reportComment} onDismiss={() => setReportComment(null)} />}</LiveShell>;
}
export function LivePerson({ id }: { id: string }) { return <StagePerson id={id} />; }

export function LivePublicUser({ handle }: { handle: string }) {
  const user = useResource<{ handle: string; displayName: string; bio: string }>(api(`users/${encodeURIComponent(handle)}`));
  if (!user.data) return <LiveShell><h1>公开主页</h1><Failure error={user.error} />{user.loading && <p role="status">正在加载公开资料…</p>}</LiveShell>;
  return <LiveFeed filter={`&author=${encodeURIComponent(handle)}`} heading={`${user.data.displayName} · @${handle}`} intro={<><p>{user.data.bio}</p><BlockButton handle={handle} /></>} />;
}
