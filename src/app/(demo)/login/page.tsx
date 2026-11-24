import { AuthFrame } from "@/components/auth-frame";
import { AuthForm } from "@/components/auth-form";
import { safeReturnTo } from "@/lib/account-rules";
export const metadata = { title: "登录 · 入戏 InRole" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthFrame><AuthForm mode="login" next={safeReturnTo(next)} /></AuthFrame>;
}
