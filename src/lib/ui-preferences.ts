export type UIPreferences = {
  theme: "light" | "dark" | "system";
  accent: "blue";
  language: "zh" | "en";
  fontSize: "small" | "normal" | "large" | "extra";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
};
export const UI_PREFERENCES_KEY = "inrole.ui.preferences.v1";
export const DEFAULT_UI_PREFERENCES: UIPreferences = { theme: "light", accent: "blue", language: "zh", fontSize: "normal", density: "comfortable", reduceMotion: false };
export const FONT_SCALES = { small: 0.9375, normal: 1, large: 1.125, extra: 1.25 } as const;
export function parseUIPreferences(raw: string | null): UIPreferences {
  let value: Record<string, unknown> = {};
  try { const parsed: unknown = JSON.parse(raw ?? "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>; } catch { /* Invalid preferences fall back without touching community content. */ }
  const oneOf = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T): T => typeof candidate === "string" && allowed.includes(candidate as T) ? candidate as T : fallback;
  return {
    theme: oneOf(value.theme, ["light", "dark", "system"], "light"),
    accent: "blue",
    language: oneOf(value.language, ["zh", "en"], "zh"),
    fontSize: oneOf(value.fontSize, ["small", "normal", "large", "extra"], "normal"),
    density: oneOf(value.density, ["comfortable", "compact"], "comfortable"),
    reduceMotion: typeof value.reduceMotion === "boolean" ? value.reduceMotion : false,
  };
}
