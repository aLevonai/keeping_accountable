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

  // Verify the JWT locally for the routing decision instead of calling the auth
  // server on every navigation (getUser() is a network round-trip). getClaims()
  // validates the token signature locally and only hits the network to fetch the
  // signing keys once (cached thereafter).
  const {
    data: claims,
  } = await supabase.auth.getClaims();
  const isAuthed = Boolean(claims?.claims?.sub);

  const isAuthRoute = request.nextUrl.pathname.startsWith("/welcome") ||
    request.nextUrl.pathname.startsWith("/onboard") ||
    request.nextUrl.pathname === "/";

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
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|apple-touch-icon\\.png).*)",
  ],
};
