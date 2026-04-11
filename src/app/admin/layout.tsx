import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/admin");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div className="admin-top__inner">
          <Link href="/admin" className="admin-brand">
            IELTS Pro <span>Admin</span>
          </Link>
          <nav className="admin-nav" aria-label="Admin">
            <Link href="/admin/categories">Categories</Link>
            <Link href="/admin/exams">Mock exams</Link>
            <Link href="/mock-exam">View catalog</Link>
            <Link href="/">Home</Link>
          </nav>
        </div>
      </header>
      <div className="admin-main">{children}</div>
    </div>
  );
}
