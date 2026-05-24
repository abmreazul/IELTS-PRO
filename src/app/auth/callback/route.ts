import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sanitizeRelativeRedirectPath } from "@/lib/security/redirect";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const PROFILE_COOKIE_KEY = "ielts_ca_profile";

function parseProfileDraft(raw: string | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      full_name?: string;
      institution?: string;
      referral_name?: string;
    };
    return {
      full_name: parsed.full_name?.trim() || null,
      institution: parsed.institution?.trim() || null,
      referral_name: parsed.referral_name?.trim() || null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRelativeRedirectPath(searchParams.get("next"), origin);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/sign-in?error=config`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* middleware will refresh cookies on next navigation */
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const draft = parseProfileDraft(cookieStore.get(PROFILE_COOKIE_KEY)?.value);
      if (user && draft) {
        const admin = createServiceRoleClient();
        const { data: authUser } = await admin.auth.admin.getUserById(user.id);
        const currentMeta = (authUser.user?.user_metadata ?? {}) as Record<string, unknown>;
        const mergedMeta = {
          ...currentMeta,
          ...(draft.full_name ? { full_name: draft.full_name } : {}),
          ...(draft.institution ? { institution: draft.institution } : {}),
          ...(draft.referral_name ? { referral_name: draft.referral_name } : {}),
        };
        await Promise.all([
          admin.auth.admin.updateUserById(user.id, { user_metadata: mergedMeta }),
          admin.from("profiles").upsert({
            id: user.id,
            full_name: draft.full_name,
            institution: draft.institution,
            referral_name: draft.referral_name,
          }),
        ]).catch(() => {
          /* referral/profile sync is best-effort */
        });
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(PROFILE_COOKIE_KEY, "", { path: "/", maxAge: 0, sameSite: "lax" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
