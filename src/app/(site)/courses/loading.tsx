import "../../courses/courses.css";

export default function CoursesLoading() {
  return (
    <main className="courses-page">
      <section className="container courses-page__head">
        <div className="skel skel-text" style={{ width: "6rem", height: "0.95rem", borderRadius: "999px" }} />
        <div className="courses-page__intro">
          <div className="skel skel-text" style={{ width: "18rem", height: "3rem", marginTop: "0.8rem" }} />
        </div>
      </section>

      <section className="container courses-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="course-card">
            <div className="course-card__media">
              <div className="skel" style={{ width: "100%", height: "100%" }} />
            </div>
            <div className="course-card__body">
              <div className="course-card__meta">
                <div className="skel skel-text" style={{ width: "5.5rem", height: "0.9rem" }} />
                <div className="skel skel-text" style={{ width: "5rem", height: "0.9rem" }} />
              </div>
              <div className="skel skel-text" style={{ width: "80%", height: "1.5rem" }} />
              <div className="skel skel-text" style={{ width: "92%", height: "1rem" }} />
              <div className="course-card__footer">
                <div className="skel skel-text" style={{ width: "7rem", height: "0.95rem" }} />
                <div className="skel skel-text" style={{ width: "7.5rem", height: "0.95rem" }} />
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
