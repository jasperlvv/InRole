"use client";
import { useSyncExternalStore } from "react";
import { DEFAULT_UI_PREFERENCES, parseUIPreferences, UI_PREFERENCES_KEY, type UIPreferences } from "./ui-preferences";

const EVENT = "inrole:ui-preferences";
const serverSnapshot = { preferences: DEFAULT_UI_PREFERENCES, ready: false, persistent: true };
let cached = serverSnapshot;
let source: string | null | undefined;
let memoryOnly = false;
function read() {
  if (typeof window === "undefined") return serverSnapshot;
  if (memoryOnly) return cached;
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_KEY);
    if (!cached.ready || source !== raw) { source = raw; cached = { preferences: parseUIPreferences(raw), ready: true, persistent: true }; }
  } catch { memoryOnly = true; cached = { preferences: cached.preferences, ready: true, persistent: false }; }
  return cached;
}
function subscribe(listener: () => void) { window.addEventListener(EVENT, listener); window.addEventListener("storage", listener); return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); }; }
export function useUIPreferences() { return useSyncExternalStore(subscribe, read, () => serverSnapshot); }
export function updateUIPreferences(patch: Partial<UIPreferences>) {
  const next = parseUIPreferences(JSON.stringify({ ...read().preferences, ...patch }));
  try { localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(next)); memoryOnly = false; source = undefined; }
  catch { memoryOnly = true; cached = { preferences: next, ready: true, persistent: false }; }
  window.dispatchEvent(new Event(EVENT));
}
export function resetUIPreferences() { updateUIPreferences(DEFAULT_UI_PREFERENCES); }
function subscribeSystem(listener: () => void) { const media = window.matchMedia("(prefers-color-scheme: dark)"); media.addEventListener("change", listener); return () => media.removeEventListener("change", listener); }
export function useSystemDark() { return useSyncExternalStore(subscribeSystem, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false); }
