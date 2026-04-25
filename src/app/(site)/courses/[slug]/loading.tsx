import "../../../courses/courses.css";

export default function CourseDetailLoading() {
  return (
    <main className="course-detail-page">
      <section className="container course-detail__hero">
        <div className="skel skel-text" style={{ width: "8rem", height: "1rem" }} />

        <div className="course-detail__hero-grid">
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="skel skel-text" style={{ width: "7rem", height: "0.95rem", borderRadius: "999px" }} />
            <div className="skel skel-text" style={{ width: "70%", height: "3rem" }} />
            <div className="skel skel-text" style={{ width: "92%", height: "1rem" }} />
            <div className="skel skel-text" style={{ width: "60%", height: "1rem" }} />
          </div>
        </div>
      </section>

      <section className="container course-detail__content">
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="skel skel-text" style={{ width: "12rem", height: "1.2rem" }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "88px 1fr auto",
                gap: "1rem",
                alignItems: "center",
                padding: "1rem 1.1rem",
                borderRadius: "20px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div className="skel" style={{ width: "88px", height: "56px", borderRadius: "14px" }} />
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div className="skel skel-text" style={{ width: "14rem", maxWidth: "100%", height: "1rem" }} />
                <div className="skel skel-text" style={{ width: "8rem", height: "0.9rem" }} />
              </div>
              <div className="load-spinner load-spinner--sm" aria-hidden />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
