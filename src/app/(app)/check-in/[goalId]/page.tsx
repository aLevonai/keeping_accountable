import { CheckIn } from "./check-in";

// Static-on-demand so the page can be fully prefetched from the + buttons.
export async function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  return <CheckIn goalId={goalId} />;
}
