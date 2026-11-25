import { LiveAuthForm } from "@/components/live-auth";
import { liveReturnTo } from "@/lib/live-auth-rules";
export const metadata = { title: "登录真实账号 · InRole" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LiveAuthForm mode="login" next={liveReturnTo(next)} />;
}
