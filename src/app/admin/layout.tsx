import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { SiteHeader } from "@/components/layout/site-header";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthUser();

  if (!user) {
    redirect("/sign-in?next=/admin");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/");
  }

  return (
    <>
      <SiteHeader adminNavActive />
      <div className="admin-shell">
        <div className="admin-main admin-main--flush">{children}</div>
        <footer className="admin-footer">
          <Link href="/admin/categories">Categories</Link>
          <span aria-hidden>·</span>
          <Link href="/admin/exams">Mock exams</Link>
          <span aria-hidden>·</span>
          <Link href="/admin/courses">Courses</Link>
          <span aria-hidden>·</span>
          <Link href="/admin/payments">Payments</Link>
          <span aria-hidden>·</span>
          <Link href="/admin/reviews">Reviews</Link>
          <span aria-hidden>·</span>
          <Link href="/mock-exam">Public catalog</Link>
        </footer>
      </div>
    </>
  );
}
