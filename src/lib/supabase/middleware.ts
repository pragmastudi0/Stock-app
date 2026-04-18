import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");

  if (user && path === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/stock";
    return NextResponse.redirect(redirectUrl);
  }

  const isProtected =
    path === "/" ||
    path.startsWith("/stock") ||
    path.startsWith("/sales");

  if (!user && isProtected && !isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    const nextDest = path === "/" ? "/stock" : path;
    redirectUrl.searchParams.set("next", nextDest);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    const nextParam = redirectUrl.searchParams.get("next");
    const safeNext =
      nextParam &&
      nextParam.startsWith("/") &&
      !nextParam.startsWith("//") &&
      !nextParam.startsWith("/login") &&
      !nextParam.startsWith("/signup")
        ? nextParam
        : "/stock";
    redirectUrl.pathname = safeNext;
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
