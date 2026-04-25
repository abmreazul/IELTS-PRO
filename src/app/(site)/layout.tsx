import { SiteHeader } from "@/components/layout/site-header";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthUser } from "@/lib/supabase/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthUser();
  const showAdminLink = isAdminEmail(user?.email);

  return (
    <>
      <SiteHeader showAdminLink={showAdminLink} />
      {children}
    </>
  );
}
