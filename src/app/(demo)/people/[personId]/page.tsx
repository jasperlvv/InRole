import { notFound } from "next/navigation";
import { CommunityShell } from "@/components/community-shell";
import { PersonContent } from "@/components/public-content";
import { findPerson } from "@/lib/content-model";
export default async function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const person = findPerson(personId);
  if (!person) notFound();
  return <CommunityShell><PersonContent person={person} /></CommunityShell>;
}
