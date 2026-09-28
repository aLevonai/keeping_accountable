import { JoinRedirect } from "./join-redirect";

// Invite links: /join/ROSE-123456. Public (see proxy.ts) — the code is
// remembered on the device, then the user signs in and lands on the join step.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinRedirect code={decodeURIComponent(code).toUpperCase()} />;
}
