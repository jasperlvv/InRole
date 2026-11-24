import type { CSSProperties } from "react";

export type IconName = "home" | "fire" | "people" | "user" | "plus" | "search" | "arrow" | "heart" | "comment" | "chevron" | "eye" | "eye-off" | "check" | "logout" | "spark" | "close" | "back" | "image" | "video" | "poll" | "quote" | "share" | "settings" | "sun" | "moon" | "monitor" | "globe" | "type" | "more" | "wallet" | "layout" | "coin";
const paths: Record<IconName, React.ReactNode> = {
  coin: <><circle cx="12" cy="12" r="9.5" /><rect x="9" y="9" width="6" height="6" rx=".3" /><path d="M12 5.5v1M12 17.5v1M5.5 12h1M17.5 12h1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3-1 3-3 1 1 4-2 2 2 3 4-1 2 3 3-1 1-4 3-1-1-4-3-1-1-3Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />,
  monitor: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M12 16v5m-5 0h10" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  type: <path d="M4 5h16M12 5v15m-4 0h8" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  wallet: <><path d="M20 7V4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16V7H5a1 1 0 0 1 0-2" /><path d="M21 11h-6v5h6" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3Z" /></>,
  poll: <><path d="M4 21V11h4v10M10 21V4h4v17M16 21v-7h4v7" /></>,
  quote: <><path d="M4 7h6v7H5l-1 4M14 7h6v7h-5l-1 4" /></>,
  share: <><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" /></>,
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  fire: <><path d="M13 3c1 6-4 5-3 10-3-1-3-4-3-4-6 7-1 13 5 12 7-1 10-10 1-18Z" /><path d="M12 15c-3 3-1 5 1 5" /></>,
  people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  comment: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6a9 9 0 1 1 16.6-4.9Z" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="m3 3 18 18M10 5.2a11 11 0 0 1 2-.2c6.5 0 10 7 10 7a17 17 0 0 1-4 4.7M6.4 6.4A18 18 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5-1.2" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  logout: <><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4" /></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4m-2-2h4" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
};
export function Icon({ name, size = 21, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
