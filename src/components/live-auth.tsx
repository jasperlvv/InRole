"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { AccountDTO } from "@/lib/api-types";
import { liveReturnTo } from "@/lib/live-auth-rules";
import { handleError, passwordError } from "@/lib/account-rules";
import { AuthRequestError, authRequest, readAccount } from "@/data/auth-api";
import styles from "./live-auth.module.css";

function LiveFrame({ children }: { children: React.ReactNode }) {
  return <div className={styles.screen}><header className={styles.header}><Link className={styles.brand} href="/"><Image src="/brand/inrole-logo-v2.jpg" width={52} height={52} alt="" /><strong>InRole <span>入戏</span></strong></Link><nav className={styles.actions}><Link href="/live">帖子广场</Link><Link href="/live/activity">我的活动</Link><Link href="/live/wallet">通宝钱包</Link></nav></header><main className={styles.main}>{children}</main><footer className={styles.footer}>真实账号 · ID 与密码登录 <Link href="/demo">切换到演示预览</Link></footer></div>;
}
function Failure({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className={styles.error} role="alert"><p>{error instanceof Error ? error.message : "操作失败，请重试。"}</p>{error instanceof AuthRequestError && <>{error.fields && <ul>{Object.entries(error.fields).map(([field, message]) => <li key={field}>{message}</li>)}</ul>}{error.retryAfter && <small>约 {error.retryAfter} 秒后可再试。</small>}{error.requestId && <small>反馈编号：{error.requestId}</small>}</>}</div>;
}
export function LiveAuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const registering = mode === "register";
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    const issue = handleError(handle) || passwordError(password);
    if (issue) { setError(new Error(issue)); return; }
    setPending(true); setError(null);
    try {
      const account = await authRequest<AccountDTO>(`/api/v1/auth/${mode}`, "POST", { handle, password });
      setPassword("");
      const target = liveReturnTo(next);
      router.replace(account.onboardingComplete ? target : `/live/onboarding?next=${encodeURIComponent(target)}`);
      router.refresh();
    } catch (failure) { setError(failure); }
    finally { setPending(false); }
  }
  return <LiveFrame><div className={styles.card}><p className={styles.eyebrow}>换个身份，说你的话。</p><h1>{registering ? "加入入戏" : "欢迎回来"}</h1><p className={styles.subtitle}>{registering ? "一个 ID，一个密码，开启你的故事。" : "使用你的个人 ID 和密码登录。"}</p><form onSubmit={submit}>
    <label htmlFor="real-handle">个人 ID</label><input id="real-handle" name="handle" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40} value={handle} disabled={pending} onChange={event => setHandle(event.target.value)} aria-describedby="real-handle-help" /><small id="real-handle-help">3～20 位字母、数字或下划线，不区分大小写。</small>
    <label htmlFor="real-password">密码</label><div className={styles.password}><input id="real-password" name="password" type={visible ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} required value={password} disabled={pending} onChange={event => setPassword(event.target.value)} aria-describedby="real-password-help" /><button type="button" onClick={() => setVisible(value => !value)} aria-pressed={visible} aria-label={visible ? "隐藏密码" : "显示密码"}>{visible ? "隐藏" : "显示"}</button></div><small id="real-password-help">8～64 个字符，支持中文和空格。</small>
    <Failure error={error} /><button className={`button button-accent ${styles.submit}`} type="submit" disabled={pending}>{pending ? "正在处理…" : registering ? "注册账号" : "登录"}</button>
  </form>{registering && <p>点击注册表示你已阅读并同意<Link href="/terms">用户协议</Link>和<Link href="/privacy">隐私政策</Link>。</p>}{!registering && <p><Link href="/live/recover">用恢复码找回账号</Link></p>}<p className={styles.switch}>{registering ? "已有账号？" : "还没有账号？"}<Link href={`/live/${registering ? "login" : "register"}?next=${encodeURIComponent(liveReturnTo(next))}`}>{registering ? "去登录" : "注册一个 ID"}</Link></p></div></LiveFrame>;
}
export function LiveAccount({ onboarding = false, next = "/live/people" }: { onboarding?: boolean; next?: string }) {
  const [account, setAccount] = useState<AccountDTO | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void readAccount(signal).then(value => { if (!signal.aborted) { setAccount(value); setName(value.displayName); setBio(value.bio); setError(null); setReady(true); } }).catch(failure => { if (!signal.aborted) { setAccount(null); setReady(true); setError(failure); } });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); };
  }, []);
  async function perform(action: () => Promise<void>) {
    if (pending) return; setPending(true); setError(null); setNotice("");
    try { await action(); } catch (failure) { setError(failure); if (failure instanceof AuthRequestError && [401, 403].includes(failure.status)) setAccount(null); }
    finally { setPending(false); }
  }
  async function signOut() {
    await authRequest("/api/v1/auth/logout", "POST", {});
    setAccount(null); router.replace("/live/login?signedOut=1"); router.refresh();
  }
  async function passwordSubmit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      await authRequest("/api/v1/auth/change-password", "POST", { oldPassword, newPassword });
      setOldPassword(""); setNewPassword(""); setAccount(null); setNotice("密码已更新，所有设备的旧会话已退出。请使用新密码重新登录。");
    });
  }
  async function profileSubmit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => { setAccount(await authRequest<AccountDTO>("/api/v1/me", "PATCH", { displayName: name, bio })); setNotice("资料已保存。"); });
  }
  return <LiveFrame><div className={styles.card}><p className={styles.eyebrow}>你的 InRole 账号</p><h1>{onboarding ? "欢迎入戏" : "账号设置"}</h1>{!ready && <p role="status">正在验证账号…</p>}<Failure error={error} />{notice && <p className={styles.notice} role="status">{notice}</p>}
    {account ? <><p className={styles.subtitle}>已登录为 @{account.handle}</p>{onboarding ? <><p>账号已创建并登录。喜好选择将在下一步开放，现在可以先认识几位人物。</p><div className={styles.actions}><Link className="button button-accent" href={liveReturnTo(next)}>开始浏览</Link><Link className="button button-outline" href="/live/me">管理账号</Link></div></> : <>
      <form onSubmit={profileSubmit}><h2>个人资料</h2><Link href="/live/account-controls">屏蔽管理与账号注销</Link><Link href="/live/recovery-codes">生成账号恢复码</Link><Link href="/live/preferences">修改我的喜好</Link><label htmlFor="real-name">显示昵称</label><input id="real-name" value={name} onChange={event => setName(event.target.value)} disabled={pending} required /><label htmlFor="real-bio">个人简介</label><textarea id="real-bio" value={bio} onChange={event => setBio(event.target.value)} disabled={pending} rows={3} /><button type="submit" className="button button-outline" disabled={pending}>保存资料</button></form>
      <form onSubmit={passwordSubmit} className={styles.divider}><h2>修改密码</h2><p>修改成功后，所有设备都需要重新登录。</p><label htmlFor="old-password">旧密码</label><input id="old-password" type="password" autoComplete="current-password" value={oldPassword} onChange={event => setOldPassword(event.target.value)} disabled={pending} required /><label htmlFor="new-password">新密码</label><input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={pending} required /><button type="submit" className="button button-accent" disabled={pending}>更新密码并退出所有设备</button></form>
    </>}<button className={`button button-outline ${styles.signOut}`} disabled={pending} onClick={() => void perform(signOut)}>退出当前账号</button></> : ready && <Link className="button button-accent" href="/live/login">登录真实账号</Link>}
  </div></LiveFrame>;
}
export function LiveAccountNav() {
  const [account, setAccount] = useState<AccountDTO | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [grantFailed, setGrantFailed] = useState(false);
  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void readAccount(signal).then(value => { if (!signal.aborted) { setAccount(value); setStatus("ready"); void authRequest("/api/v1/community/claim", "POST", {}).then(() => setGrantFailed(false)).catch(() => setGrantFailed(true)); } }).catch(failure => {
        if (signal.aborted) return;
        setAccount(null); setStatus(failure instanceof AuthRequestError && failure.status === 401 ? "ready" : "error");
      });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); };
  }, []);
  return <nav aria-label="真实账号" className={styles.nav}>{status === "loading" ? <span>正在验证账号…</span> : status === "error" ? <Link href="/live/me">账号状态暂不可用</Link> : account ? <><Link href="/live/me">@{account.handle}</Link>{grantFailed && <Link href="/live/wallet">通宝领取待确认</Link>}</> : <Link href="/live/login">登录 / 注册</Link>}</nav>;
}
