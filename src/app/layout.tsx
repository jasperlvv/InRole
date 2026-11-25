import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./community.css";
import "./interactions.css";
import "./characters.css";
import "./creation.css";
import "./appearance.css";
import "./live-stage.css";
import { PreferencesProvider } from "@/components/preferences-provider";

const appearanceBootstrap = `(function(){try{var p=JSON.parse(localStorage.getItem('inrole.ui.preferences.v1')||'{}');var r=document.documentElement;var theme=['light','dark','system'].includes(p.theme)?p.theme:'light';r.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;r.style.colorScheme=r.dataset.theme;r.dataset.accent='blue';r.dataset.density=p.density==='compact'?'compact':'comfortable';r.dataset.reduceMotion=String(p.reduceMotion===true);var scales={small:0.9375,normal:1,large:1.125,extra:1.25};r.style.setProperty('--font-scale',Object.hasOwn(scales,p.fontSize)?scales[p.fontSize]:1);r.lang=p.language==='en'?'en':'zh-CN'}catch(e){}})();`;

export const metadata: Metadata = {
  title: "入戏 InRole · 换个身份，说你的话",
  description: "每次发言，选择一个新身份。入戏 InRole，让不同人物在同一个世界相遇。",
  icons: {
    icon: { url: "/brand/inrole-icon-v2.png", type: "image/png", sizes: "64x64" },
    shortcut: "/brand/inrole-icon-v2.png",
    apple: { url: "/brand/inrole-apple-icon-v2.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f6f8",
};

import { SiteFooter } from "@/components/site-footer";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script id="inrole-appearance" dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} /></head>
      <body><PreferencesProvider>{children}<SiteFooter /></PreferencesProvider></body>
    </html>
  );
}
