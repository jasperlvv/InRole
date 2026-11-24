import { CommunityShell } from "@/components/community-shell";
import { PostDetail } from "@/components/post-detail";
export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <CommunityShell><PostDetail postId={postId} /></CommunityShell>;
}
