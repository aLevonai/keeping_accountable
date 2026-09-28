import { EditGoal } from "./edit-goal";

export async function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditGoal id={id} />;
}
