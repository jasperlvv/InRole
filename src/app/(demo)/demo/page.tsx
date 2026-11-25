import { CommunityShell } from "@/components/community-shell";
import { Feed } from "@/components/feed";
export const metadata = { title: "前端演示 · InRole", robots: { index: false, follow: false } };
export default function DemoPage() { return <CommunityShell><Feed /></CommunityShell>; }
