import { notFound } from "next/navigation";
import { LiveFeed, LivePost, LivePerson, LivePreferences, LiveComposer, LivePublicUser } from "@/components/live-community";
import { LiveWallet, LiveTrending, LiveRankings, LiveActivity, LiveRequest, LiveAdmin } from "@/components/live-dashboard";
import { LiveShell } from "@/components/live-shared";
import { InterfaceSettings } from "@/components/interface-settings";
import { LiveRecovery } from "@/components/live-recovery";
import { LiveAccountControls } from "@/components/live-controls";
export default async function CommunityPage({ params, searchParams }: { params: Promise<{ path: string[] }>; searchParams: Promise<{ quote?: string; person?: string }> }) {
  const { path } = await params, [page, id] = path;
  if (path.length === 1) {
    if (page === "account-controls") return <LiveAccountControls />;
    if (page === "recover") return <LiveRecovery />;
    if (page === "recovery-codes") return <LiveRecovery generate />;
    if (page === "settings") return <LiveShell><InterfaceSettings /></LiveShell>;
    if (page === "preferences") return <LivePreferences />;
    if (page === "wallet") return <LiveWallet />;
    if (page === "trending") return <LiveTrending />;
    if (page === "rankings") return <LiveRankings />;
    if (page === "activity") return <LiveActivity />;
    if (page === "request") return <LiveRequest />;
    if (page === "admin") return <LiveAdmin />;
    if (page === "compose") return <LiveShell><LiveComposer quoteId={(await searchParams).quote || ""} initialPersonId={(await searchParams).person || ""} /></LiveShell>;
  }
  if (path.length === 2) {
    if (page === "posts") return <LivePost id={id} />;
    if (page === "people") return <LivePerson id={id} />;
    if (page === "topics") return <LiveFeed filter={`&topic=${encodeURIComponent(id)}`} heading="话题里的故事" />;
    if (page === "person-posts") return <LiveFeed filter={`&person=${encodeURIComponent(id)}`} heading="人物的故事" />;
    if (page === "users") return <LivePublicUser handle={id} />;
  }
  notFound();
}
