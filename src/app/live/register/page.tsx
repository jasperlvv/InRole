import { LiveAuthForm } from "@/components/live-auth";
import { liveReturnTo } from "@/lib/live-auth-rules";
export const metadata = { title: "注册真实账号 · InRole" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LiveAuthForm mode="register" next={liveReturnTo(next)} />;
}
