"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authRequest } from "@/data/auth-api";
import { Failure, LiveShell } from "./live-shared";
import s from "./live-community.module.css";
export function LiveRecovery({ generate = false }: { generate?: boolean }) {
  const [codes, setCodes] = useState<string[] | null>(null), [notice, setNotice] = useState(""), [error, setError] = useState<unknown>(null), [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, payload = Object.fromEntries(new FormData(form)); setPending(true); setError(null); setCodes(null);
    try { if (generate) { const result = await authRequest<{ codes: string[] }>("/api/v1/auth/recovery-codes", "POST", payload); setCodes(result.codes); } else { await authRequest("/api/v1/auth/recover", "POST", payload); setNotice("密码已重置，所有旧会话已退出，请重新登录。"); } form.reset(); } catch (error) { setError(error); } finally { setPending(false); }
  }
  return <LiveShell><h1>{generate ? "保存账号恢复码" : "用恢复码找回账号"}</h1><p>{generate ? "验证当前密码后生成8个一次性恢复码。新码会替换旧码，请离线妥善保存；关闭页面后无法再次查看。" : "输入个人ID、一个尚未使用的恢复码和新密码。没有恢复码时，仍登录的设备可在账号设置中修改密码。"}</p><form className={s.card} onSubmit={submit}>{generate ? <label>当前密码<input name="password" type="password" autoComplete="current-password" required /></label> : <><label>个人ID<input name="handle" autoComplete="username" required /></label><label>一次性恢复码<input name="code" autoComplete="off" required /></label><label>新密码<input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={64} required /></label></>}<Failure error={error} />{notice && <p role="status">{notice}</p>}<button disabled={pending}>{generate ? "生成并显示恢复码" : "重置密码"}</button></form>{codes && <section className={s.card}><h2>仅显示这一次</h2>{codes.map(code => <p key={code}><code>{code}</code></p>)}<p>每个码只能用一次。请勿发送给他人。</p></section>}<Link href={generate ? "/live/me" : "/live/login"}>{generate ? "回到账号设置" : "回到登录"}</Link></LiveShell>;
}
