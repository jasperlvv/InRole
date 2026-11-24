import { AuthFrame } from "@/components/auth-frame";
import { OnboardingForm } from "@/components/onboarding-form";
import { safeReturnTo } from "@/lib/account-rules";
export const metadata = { title: "选择喜好 · 入戏 InRole" };
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthFrame onboarding><OnboardingForm next={safeReturnTo(next)} /></AuthFrame>;
}
