export function normalizeHandle(value: string) { return value.trim().toLowerCase(); }

export function handleError(value: string): string | null {
  return /^[a-z0-9_]{3,20}$/.test(normalizeHandle(value)) ? null : "个人 ID 需为 3～20 位英文字母、数字或下划线。";
}

export function passwordError(value: string): string | null {
  const length = Array.from(value).length;
  return length >= 8 && length <= 64 ? null : "密码需为 8～64 个字符。";
}

export function safeReturnTo(value?: string | string[]): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return "/";
    const url = new URL(value, "https://inrole.invalid");
    if (url.origin !== "https://inrole.invalid" || /^\/(login|register|onboarding)(\/|$)/.test(decodeURIComponent(url.pathname))) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

export function authHref(path: "/login" | "/register" | "/onboarding", next = "/") {
  const safe = safeReturnTo(next);
  return safe === "/" ? path : `${path}?next=${encodeURIComponent(safe)}`;
}
