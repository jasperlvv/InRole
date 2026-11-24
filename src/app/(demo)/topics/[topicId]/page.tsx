import { notFound } from "next/navigation";
import { CommunityShell } from "@/components/community-shell";
import { TopicContent } from "@/components/public-content";
import { findTopic } from "@/lib/content-model";
export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params; const topic = findTopic(topicId);
  if (!topic) notFound();
  return <CommunityShell><TopicContent topic={topic} /></CommunityShell>;
}
