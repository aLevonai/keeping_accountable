import { GoalDetail } from "./goal-detail";

// Returning [] makes this route static-on-demand: each goal page is rendered
// once, cached, and fully prefetchable — so opening a goal is instant.
export async function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoalDetail id={id} />;
}
