import { notFound } from "next/navigation";
import { CommunityShell } from "@/components/community-shell";
import { UserContent } from "@/components/public-content";
export default async function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) notFound();
  return <CommunityShell><UserContent handle={handle} /></CommunityShell>;
}
