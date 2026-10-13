import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { classifyAdminAccess } from "@/lib/admin/access";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function redirectWithSessionCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  error?: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (error) {
    url.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }

  return response;
}

export async function updateAdminSession(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/admin/login";
  let config;

  try {
    config = getSupabasePublicConfig();
  } catch {
    if (isLogin) return NextResponse.next({ request });

    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("error", "configuration");
    return NextResponse.redirect(url);
  }

  let sessionResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        sessionResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          sessionResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (!userId || claimsError) {
    return isLogin
      ? sessionResponse
      : redirectWithSessionCookies(request, sessionResponse, "/admin/login", "authentication");
  }

  const { data: admin, error: adminError } = await supabase
    .from("ecommerce_admin_users")
    .select("is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const access = classifyAdminAccess({
    userId,
    adminCheckFailed: Boolean(adminError),
    isActiveAdmin: admin?.is_active === true
  });

  if (access.status === "authorized") {
    return isLogin
      ? redirectWithSessionCookies(request, sessionResponse, "/admin/produtos")
      : sessionResponse;
  }

  if (isLogin) return sessionResponse;

  const error = access.status === "verification_error" ? "verification" : "access_denied";
  return redirectWithSessionCookies(request, sessionResponse, "/admin/login", error);
}
