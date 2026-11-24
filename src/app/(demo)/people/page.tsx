import { CommunityShell } from "@/components/community-shell";
import { PeopleDirectory } from "@/components/people-directory";
export const metadata = { title: "人物剧场 · 入戏 InRole" };
export default function PeoplePage() { return <CommunityShell><PeopleDirectory /></CommunityShell>; }
