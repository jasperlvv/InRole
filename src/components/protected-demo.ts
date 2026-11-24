"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemoSession } from "@/lib/demo-session";
import { authHref } from "@/lib/account-rules";
export function useProtectedDemo(next: string) {
  const session = useDemoSession(); const router = useRouter();
  useEffect(() => { if (session.ready && !session.user) router.replace(authHref("/login", next)); else if (session.user && !session.user.onboardingComplete) router.replace(authHref("/onboarding", next)); }, [session.ready, session.user, router, next]);
  return { ...session, available: session.ready && Boolean(session.user?.onboardingComplete) };
}
