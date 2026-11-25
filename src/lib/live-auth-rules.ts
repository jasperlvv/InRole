import { safeReturnTo } from "./account-rules.ts";
export function liveReturnTo(value?: string | string[]): string {
  const safe = safeReturnTo(value);
  const pathname = decodeURIComponent(new URL(safe, "https://inrole.invalid").pathname);
  return /^\/live(?:\/|$)/.test(pathname) && !/^\/live\/(login|register|onboarding)(?:\/|$)/.test(pathname) ? safe : "/live/people";
}
