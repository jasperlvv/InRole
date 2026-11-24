"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { FONT_SCALES } from "@/lib/ui-preferences";
import { useUIPreferences } from "@/lib/use-ui-preferences";
import { translateUI } from "@/lib/ui-messages";

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { preferences, ready } = useUIPreferences();
  const pathname = usePathname();
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = preferences.theme === "system" ? media.matches ? "dark" : "light" : preferences.theme;
      const root = document.documentElement;
      root.dataset.theme = theme; root.dataset.accent = preferences.accent;
      root.dataset.density = preferences.density; root.dataset.reduceMotion = String(preferences.reduceMotion);
      root.style.setProperty("--font-scale", String(FONT_SCALES[preferences.fontSize]));
      root.style.colorScheme = theme; root.lang = preferences.language === "en" ? "en" : "zh-CN";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#101216" : "#f5f6f8");
    };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [preferences, ready]);
  useEffect(() => {
    if (!ready) return;
    const title = pathname === "/settings" ? "设置" : pathname === "/me/settings" ? "账号设置" : pathname === "/me/wallet" ? "我的通宝" : pathname === "/me/preferences" ? "我的喜好" : pathname.startsWith("/me") ? "个人中心" : pathname === "/people/request" ? "人物申请" : pathname.startsWith("/people") ? "人物剧场" : pathname === "/rankings" ? "人物排行榜" : pathname.startsWith("/trending") || pathname.startsWith("/topics") ? "热搜话题" : pathname.startsWith("/posts") ? "这一出戏" : pathname === "/login" ? "登录 / 注册" : pathname === "/register" ? "注册一个 ID" : pathname === "/onboarding" ? "我的喜好" : "帖子广场";
    document.title = `${pathname.startsWith("/live") ? "人物剧场 · 真实数据" : translateUI(title, preferences.language)} · InRole`;
  }, [pathname, preferences.language, ready]);
  return children;
}
