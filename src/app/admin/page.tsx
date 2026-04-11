import Link from "next/link";

export default function AdminHomePage() {
  return (
    <>
      <h1 className="admin-h1">Dashboard</h1>
      <p className="admin-lead">
        Manage categories and mock exams. Changes appear on the public Mock Exam page after you save.
      </p>
      <div className="admin-card">
        <h2>Quick links</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
          <li>
            <Link href="/admin/categories">Exam categories</Link>
          </li>
          <li>
            <Link href="/admin/exams">Mock exams (create / edit / publish)</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
