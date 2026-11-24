"use client";

import { useSyncExternalStore } from "react";
import { getCurrentDemoUser } from "./demo-session";
import { createInitialContent, expandDemoSeedContent, deserializeContent, EMPTY_DRAFT, publishComment, publishPost, removeComment, removePost, setPostLike, type ContentState, type Draft } from "./content-model";
import { grantDailyCoins, tipPerson, giftPostAuthor, saveReview, removeReview, reportContent, type DemoReport } from "./content-model";
import { requestCharacter, voteInPoll } from "./content-model";
import { validateAttachments } from "./post-rules";

const CONTENT_KEY = "inrole.demo.content.v1";
const DRAFT_KEY = "inrole.demo.drafts.v1";
const BACKUP_KEY = "inrole.demo.content-backup.v1";
const EVENT = "inrole:content-change";
const empty: ContentState = { version: 1, posts: [], comments: [], likes: [], recentPeople: {}, requests: {}, reviews: [], transactions: [], reports: [], pollVotes: [], characterRequests: [] };
type Snapshot = { ready: boolean; state: ContentState; error: string | null; updatedAt: number };
const serverSnapshot: Snapshot = { ready: false, state: empty, error: null, updatedAt: 0 };
let cached = serverSnapshot;
let source: string | null = null;
let initial: ContentState | null = null;

function read(): Snapshot {
  if (typeof window === "undefined") return serverSnapshot;
  initial ??= createInitialContent(Date.now());
  try {
    const raw = window.localStorage.getItem(CONTENT_KEY) ?? "";
    if (source === raw && cached.ready) return cached;
    source = raw;
    try { cached = { ready: true, state: raw ? deserializeContent(raw) : initial, error: null, updatedAt: Date.now() }; }
    catch { cached = { ready: true, state: initial, error: "本机内容无法读取，原数据已保留。请重置示例内容后重试。", updatedAt: Date.now() }; }
  } catch {
    if (source === "__storage_blocked__") return cached;
    source = "__storage_blocked__";
    cached = { ready: true, state: initial, error: "浏览器未允许本地存储，暂时只能浏览，无法保存发言。", updatedAt: Date.now() };
  }
  return cached;
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener); window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}
function commit(state: ContentState) {
  try { window.localStorage.setItem(CONTENT_KEY, JSON.stringify(state)); }
  catch { throw new Error("本机空间不足或浏览器禁止存储，内容尚未保存，请保留草稿后重试。"); }
  source = null;
  window.dispatchEvent(new Event(EVENT));
}
function current() {
  const snapshot = read();
  if (snapshot.error) throw new Error(snapshot.error);
  const user = getCurrentDemoUser();
  if (!user || !user.onboardingComplete) throw new Error("请先登录并完成喜好引导，再参与互动。");
  return { state: snapshot.state, handle: user.handle };
}
export function useDemoContent() { return useSyncExternalStore(subscribe, read, () => serverSnapshot); }
export function refreshDemoRanking() { source = null; window.dispatchEvent(new Event(EVENT)); }
export function ensureDemoSeedExpansion() {
  const snapshot = read();
  if (snapshot.error) return;
  const next = expandDemoSeedContent(snapshot.state, Date.now());
  if (next !== snapshot.state) {
    try { commit(next); }
    catch (issue) {
      cached = { ...snapshot, error: issue instanceof Error ? issue.message : "示例内容未能补充，请刷新后重试。" };
      window.dispatchEvent(new Event(EVENT));
    }
  }
}
export function createDemoPost(draft: Draft, requestId: string) {
  const { state, handle } = current(); const result = publishPost(state, handle, draft, requestId, Date.now()); commit(result.state); return result.id;
}
export function createDemoComment(postId: string, draft: Draft, requestId: string) {
  const { state, handle } = current(); const result = publishComment(state, handle, postId, draft, requestId, Date.now()); commit(result.state); return result.id;
}
export function likeDemoPost(postId: string, liked: boolean) {
  const { state, handle } = current(); commit(setPostLike(state, handle, postId, liked, Date.now()));
}
export function deleteDemoPost(postId: string) { const { state, handle } = current(); commit(removePost(state, handle, postId)); }
export function deleteDemoComment(commentId: string) { const { state, handle } = current(); commit(removeComment(state, handle, commentId)); }
export function saveDemoReview(personId: string, score: number, body: string) { const { state, handle } = current(); commit(saveReview(state, handle, personId, score, body, Date.now())); }
export function deleteDemoReview(reviewId: string) { const { state, handle } = current(); commit(removeReview(state, handle, reviewId)); }
export function ensureDemoDailyCoins() { const { state, handle } = current(); const next = grantDailyCoins(state, handle, Date.now()); if (next !== state) commit(next); }
export function tipDemoPerson(personId: string, amount: number, requestId: string) { const { state, handle } = current(); const now = Date.now(); commit(tipPerson(grantDailyCoins(state, handle, now), handle, personId, amount, requestId, now)); }
export function giftDemoPost(postId: string, amount: number, requestId: string) { const { state, handle } = current(); const now = Date.now(); commit(giftPostAuthor(grantDailyCoins(state, handle, now), handle, postId, amount, requestId, now)); }
export function reportDemoContent(kind: DemoReport["kind"], targetId: string, reason: string) { const { state, handle } = current(); commit(reportContent(state, handle, kind, targetId, reason, Date.now())); }
export function voteDemoPoll(postId: string, optionId: string) { const { state, handle } = current(); commit(voteInPoll(state, handle, postId, optionId, Date.now())); }
export function submitDemoCharacter(input: { name: string; bio: string; sourceUrl: string }, requestId: string) { const { state, handle } = current(); const result = requestCharacter(state, handle, input, requestId, Date.now()); if (result.state !== state) commit(result.state); return result.id; }
export function resetDemoContent() {
  if (!getCurrentDemoUser()?.onboardingComplete) throw new Error("请先登录演示账号。");
  const previous = window.localStorage.getItem(CONTENT_KEY);
  if (previous) window.localStorage.setItem(BACKUP_KEY, previous);
  initial = createInitialContent(Date.now()); commit(initial);
}
export function restoreDemoContent() {
  if (!getCurrentDemoUser()?.onboardingComplete) throw new Error("请先登录演示账号。");
  const previous = window.localStorage.getItem(BACKUP_KEY);
  if (!previous) throw new Error("暂无可恢复的重置前内容。");
  commit(deserializeContent(previous));
}
export function readDraft(key: string): Draft {
  try {
    const drafts = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}");
    const draft = drafts[key];
    if (draft && typeof draft.personId === "string" && typeof draft.body === "string" && Array.isArray(draft.topicIds)) return { personId: draft.personId, body: draft.body, topicIds: draft.topicIds.filter((id: unknown) => typeof id === "string"), attachments: validateAttachments(draft.attachments), ...(draft.poll && typeof draft.poll.question === "string" && Array.isArray(draft.poll.options) && draft.poll.options.every((item: unknown) => typeof item === "string") && [24, 72, 168].includes(draft.poll.durationHours) ? { poll: draft.poll } : {}), ...(typeof draft.quotePostId === "string" ? { quotePostId: draft.quotePostId } : {}) };
  } catch { /* A draft can still be edited in memory. */ }
  return { ...EMPTY_DRAFT, topicIds: [] };
}
export function saveDraft(key: string, draft: Draft | null): string | null {
  const user = getCurrentDemoUser();
  if (!user?.onboardingComplete || !key.startsWith(`${user.handle}:`)) return "请先登录自己的演示账号，再保存草稿。";
  try {
    const drafts = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}");
    if (draft) drafts[key] = draft; else delete drafts[key];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); return null;
  } catch { return "草稿尚未保存，请勿关闭页面；可以复制正文后重试。"; }
}
