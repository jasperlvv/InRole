"use client";

import { useSyncExternalStore } from "react";
import { normalizeHandle } from "./account-rules";

export const interests = [
  { id: "history-cn", label: "中国历史", symbol: "史", description: "从先秦聊到今天" },
  { id: "history-world", label: "世界历史", symbol: "世", description: "另一边的风云人物" },
  { id: "myth", label: "神话传说", symbol: "神", description: "神仙也有人间烦恼" },
  { id: "literature", label: "文学诗词", symbol: "文", description: "和有趣的灵魂对话" },
  { id: "science", label: "科学脑洞", symbol: "理", description: "好奇心没有边界" },
  { id: "philosophy", label: "哲学思辨", symbol: "思", description: "认真想点不一样的" },
  { id: "film", label: "影视人物", symbol: "影", description: "故事之外，还有故事" },
  { id: "games", label: "游戏世界", symbol: "游", description: "换个世界继续冒险" },
  { id: "humor", label: "轻松搞笑", symbol: "乐", description: "一本正经地开玩笑" },
] as const;

export type DemoProfile = { handle: string; interests: string[]; onboardingComplete: boolean; displayName?: string; bio?: string };
type Snapshot = { ready: boolean; profiles: DemoProfile[]; currentHandle: string | null; persistent: boolean };
const PROFILES_KEY = "inrole.demo.profiles.v1";
const SESSION_KEY = "inrole.demo.session.v1";
const CHANGE_EVENT = "inrole:demo-session";
const serverSnapshot: Snapshot = { ready: false, profiles: [], currentHandle: null, persistent: true };
let cached = serverSnapshot;
let lastSource: string | null = null;
let memoryProfiles = "[]";
let memorySession = "";
let memoryOnly = false;

function readSnapshot(): Snapshot {
  if (typeof window === "undefined") return serverSnapshot;
  let rawProfiles = memoryProfiles;
  let rawSession = memorySession;
  let persistent = true;
  try {
    if (memoryOnly) throw new Error("Temporary in-memory demo");
    rawProfiles = window.localStorage.getItem(PROFILES_KEY) ?? "[]";
    rawSession = window.sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch { persistent = false; }
  const source = `${persistent}:${rawProfiles}:${rawSession}`;
  if (source === lastSource) return cached;
  let profiles: DemoProfile[] = [];
  try {
    const parsed: unknown = JSON.parse(rawProfiles);
    if (Array.isArray(parsed)) profiles = parsed.filter((item): item is DemoProfile =>
      typeof item === "object" && item !== null && typeof item.handle === "string" &&
      /^[a-z0-9_]{3,20}$/.test(item.handle) && Array.isArray(item.interests) &&
      typeof item.onboardingComplete === "boolean",
    ).map((item) => ({ handle: item.handle, interests: item.interests.filter((id) => interests.some((interest) => interest.id === id)).slice(0, 5), onboardingComplete: item.onboardingComplete, displayName: typeof item.displayName === "string" ? item.displayName.slice(0, 80) : undefined, bio: typeof item.bio === "string" ? item.bio.slice(0, 800) : undefined }));
  } catch { profiles = []; }
  cached = { ready: true, profiles, currentHandle: profiles.some((p) => p.handle === rawSession) ? rawSession : null, persistent };
  lastSource = source;
  return cached;
}

function persist(profiles: DemoProfile[], currentHandle: string | null) {
  memoryProfiles = JSON.stringify(profiles);
  memorySession = currentHandle ?? "";
  let saved = true;
  try {
    window.localStorage.setItem(PROFILES_KEY, memoryProfiles);
    if (currentHandle) window.sessionStorage.setItem(SESSION_KEY, currentHandle);
    else window.sessionStorage.removeItem(SESSION_KEY);
    memoryOnly = false;
  } catch { memoryOnly = true; saved = false; }
  lastSource = null;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return saved;
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener("storage", listener); };
}

export function useDemoSession() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => serverSnapshot);
  return { ...snapshot, user: snapshot.profiles.find((p) => p.handle === snapshot.currentHandle) ?? null };
}

export function getCurrentDemoUser() {
  const snapshot = readSnapshot();
  return snapshot.profiles.find((profile) => profile.handle === snapshot.currentHandle) ?? null;
}

export function registerDemoProfile(value: string): string | null {
  const handle = normalizeHandle(value);
  const { profiles } = readSnapshot();
  if (profiles.some((p) => p.handle === handle)) return "这个 ID 已在本机演示中使用，请换一个，或直接登录。";
  persist([...profiles, { handle, interests: [], onboardingComplete: false }], handle);
  return null;
}

export function loginDemoProfile(value: string): string | null {
  const handle = normalizeHandle(value);
  const { profiles } = readSnapshot();
  if (!profiles.some((p) => p.handle === handle)) return "本机还没有这个演示 ID，请先注册一个。";
  persist(profiles, handle);
  return null;
}

export function completeDemoOnboarding(selected: string[]) {
  const { profiles, currentHandle } = readSnapshot();
  if (!currentHandle) return;
  const valid = [...new Set(selected)].filter((id) => interests.some((interest) => interest.id === id)).slice(0, 5);
  persist(profiles.map((p) => p.handle === currentHandle ? { ...p, interests: valid, onboardingComplete: true } : p), currentHandle);
}

export function logoutDemoProfile() { persist(readSnapshot().profiles, null); }

export function updateDemoPreferences(selected: string[]) {
  const snapshot = readSnapshot(); const user = getCurrentDemoUser();
  if (!user || !user.onboardingComplete) throw new Error("请先登录并完成引导。");
  const valid = [...new Set(selected)].filter((id) => interests.some((item) => item.id === id));
  if (valid.length > 5) throw new Error("最多选择 5 项喜好。");
  if (!snapshot.persistent) throw new Error("浏览器不允许保存，喜好尚未更新。");
  if (!persist(snapshot.profiles.map((profile) => profile.handle === user.handle ? { ...profile, interests: valid } : profile), user.handle)) throw new Error("喜好仅暂存在内存，未能持久保存，请检查浏览器存储设置。");
}
export function updateDemoPublicProfile(displayName: string, bio: string) {
  const snapshot = readSnapshot(); const user = getCurrentDemoUser();
  if (!user || !user.onboardingComplete) throw new Error("请先登录并完成引导。");
  if (Array.from(displayName.trim()).length < 1 || Array.from(displayName.trim()).length > 20 || Array.from(bio.trim()).length > 200) throw new Error("昵称需为 1～20 字，简介不能超过 200 字。");
  if (!snapshot.persistent) throw new Error("浏览器不允许保存，资料尚未更新。");
  if (!persist(snapshot.profiles.map((profile) => profile.handle === user.handle ? { ...profile, displayName: displayName.trim(), bio: bio.trim() } : profile), user.handle)) throw new Error("资料仅暂存在内存，未能持久保存，请检查浏览器存储设置。");
}
