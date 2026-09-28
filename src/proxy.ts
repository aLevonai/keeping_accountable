import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Routing only needs "is there a session cookie?": every page under (app) is a
  // static client shell with no user data, and all data access is enforced by
  // RLS. getSession() reads the cookie locally and only hits the network to
  // refresh an expired token. (getClaims() falls back to getUser() — a
  // round-trip to Supabase Auth on *every* request — whenever tokens are
  // HS256-signed with the legacy JWT secret, which made uncached tab switches
  // wait on the network.)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuthed = Boolean(session?.access_token);

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/welcome") ||
    path.startsWith("/onboard") ||
    path.startsWith("/join/") || // invite links must work before sign-in
    path === "/";

  if (!isAuthed && !isAuthRoute) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  if (isAuthed && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons|manifest\\.json|sw\\.js|apple-touch-icon\\.png).*)",
      // Link prefetches fetch static shells only; skip the auth work for them.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
