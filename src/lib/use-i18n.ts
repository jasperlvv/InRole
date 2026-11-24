"use client";
import { useUIPreferences } from "./use-ui-preferences";
import { translateUI } from "./ui-messages";
export function useI18n() {
  const { preferences } = useUIPreferences();
  return { language: preferences.language, t: (message: string | undefined | null) => translateUI(message ?? "", preferences.language) };
}
