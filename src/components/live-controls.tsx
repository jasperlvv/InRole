"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authRequest } from "@/data/auth-api";
import { api, Failure, LiveShell, PageHeading, useLiveSession, useResource } from "./live-shared";

export function BlockButton({ handle, onChanged }: { handle: string; onChanged?: () => void }) {
  const session = useLiveSession(), [pending, setPending] = useState(false), [error, setError] = useState<unknown>(null), busy = useRef(false);
  if (session.account?.handle === handle) return null;
  return <><button type="button" className="text-action" disabled={pending} onClick={async () => {
    if (!session.ensureLogin() || busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { await authRequest(api(`blocks/${encodeURIComponent(handle)}`), "PUT", {}); window.dispatchEvent(new Event("inrole:retry")); onChanged?.(); }
    catch (failure) { setError(failure); } finally { busy.current = false; setPending(false); }
  }}>屏蔽 @{handle}</button><Failure error={error} /></>;
}
export function LiveAccountControls() { return <LiveShell><Controls /></LiveShell>; }
function Controls() {
  const blocks = useResource<{ handle: string; displayName: string }[]>(api("blocks")), session = useLiveSession(), router = useRouter();
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState<unknown>(null), busy = useRef(false);
  async function remove(handle: string) {
    if (busy.current) return; busy.current = true; setPending(true); setError(null);
    try { await authRequest(api(`blocks/${encodeURIComponent(handle)}`), "DELETE", {}); blocks.reload(); window.dispatchEvent(new Event("inrole:retry")); }
    catch (failure) { setError(failure); } finally { busy.current = false; setPending(false); }
  }
  async function erase(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setError(null);
    try {
      await authRequest("/api/v1/auth/delete-account", "POST", { password, confirmation });
      // Only this browser's real-community drafts belong to this account.
      try { if (session.account) sessionStorage.removeItem(`inrole.live.draft.${session.account.handle}`); } catch { /* Server deletion already succeeded. */ }
      setPassword(""); router.replace("/account-deleted"); router.refresh();
    } catch (failure) { setError(failure); } finally { busy.current = false; setPending(false); }
  }
  return <section className="personal-preview"><PageHeading title="隐私与账号" subtitle="管理屏蔽列表，或永久注销你的账号。" /><Failure error={error || blocks.error} />
    {session.ready && !session.account ? <Link className="button button-accent" href="/live/login?next=%2Flive%2Faccount-controls">登录后管理</Link> : <>
      <section className="profile-panel"><h2>已屏蔽账号</h2><p>登录后，双方的帖子、评论、评价和引用内容会在彼此的浏览中隐藏，不能评论、引用、点赞、投票或赠送通宝。屏蔽按实际账号生效，切换人物不能绕过。公开内容仍可能被游客阅读；排行榜汇总不因个人屏蔽改变。</p>{blocks.loading && <p role="status">正在读取…</p>}{blocks.data?.length === 0 && <p>暂无屏蔽账号。在帖子、评论或公开主页可操作。</p>}{blocks.data?.map(row => <p key={row.handle}>{row.displayName} · @{row.handle} <button type="button" className="button button-outline button-small" disabled={pending} onClick={() => void remove(row.handle)}>解除屏蔽</button></p>)}</section>
      <form className="profile-panel account-erasure" onSubmit={erase}><h2>永久注销账号</h2><p>注销后所有设备退出，密码与恢复码删除，公开资料清除，帖子、评论、评价和私人媒体移除。已结算通宝的最小去标识账目保留以核对其他用户收支；原ID保留防冒用摘要，不可重新注册。公共人物素材的来源信息保留。备份与他人独立发布的内容处理见<Link href="/privacy">隐私政策</Link>。</p><p><strong>此操作无法撤销。请先保存自己需要的内容和流水。</strong></p>
        <label htmlFor="erase-password">当前密码</label><input id="erase-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />
        <label htmlFor="erase-confirmation">输入“注销我的账号”确认</label><input id="erase-confirmation" required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} />
        <button type="submit" className="button button-danger" disabled={pending || confirmation !== "注销我的账号"}>永久注销我的账号</button>
      </form></>}
  </section>;
}
