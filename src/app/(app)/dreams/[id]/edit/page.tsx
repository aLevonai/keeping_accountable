import { EditDream } from "./edit-dream";

export async function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditDream id={id} />;
}
