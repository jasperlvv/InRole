import { AuthFrame } from "@/components/auth-frame";
import { AuthForm } from "@/components/auth-form";
import { safeReturnTo } from "@/lib/account-rules";
export const metadata = { title: "注册 · 入戏 InRole" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthFrame><AuthForm mode="register" next={safeReturnTo(next)} /></AuthFrame>;
}
