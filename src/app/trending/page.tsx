import { CommunityShell } from "@/components/community-shell";
import { TrendingBoard } from "@/components/trending-board";
export const metadata = { title: "热搜话题 · 入戏 InRole" };
export default function TrendingPage() { return <CommunityShell><TrendingBoard /></CommunityShell>; }
