import { CommunityShell } from "@/components/community-shell";
import { PeopleRankings } from "@/components/people-directory";
export const metadata = { title: "人物排行榜 · 入戏 InRole" };
export default function RankingsPage() { return <CommunityShell><PeopleRankings /></CommunityShell>; }
