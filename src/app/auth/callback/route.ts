import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_description = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/";

  if (error_description) {
    console.error("Auth callback error from provider:", error_description);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If next points to set-password, redirect there
      if (next === "/auth/set-password") {
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Auth code exchange error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=no_code_provided`);
}
