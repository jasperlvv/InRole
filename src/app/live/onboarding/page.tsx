import { LivePreferences } from "@/components/live-community";
import { liveReturnTo } from "@/lib/live-auth-rules";
export const metadata = { title: "欢迎入戏 · InRole" };
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LivePreferences onboarding next={liveReturnTo(next)} />;
}
