import "./mock-exam.css";

export default function MockExamLoading() {
  return (
    <main className="page me-page">
      <div className="container">
        <header className="me-page__head">
          <div className="skel skel-text" style={{ width: "200px", height: "2.2rem" }} />
          <div className="skel skel-text" style={{ width: "320px", height: "1rem", marginTop: "0.75rem" }} />
        </header>

        {/* Category sections skeleton */}
        {Array.from({ length: 2 }).map((_, s) => (
          <section key={s} className="me-section">
            <div className="skel skel-text" style={{ width: "120px", height: "1.05rem", marginBottom: "1.25rem" }} />
            <div className="me-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="me-card" style={{ minHeight: "320px" }}>
                  <div className="me-card__media">
                    <div className="skel" style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div className="me-card__body">
                    <div className="skel skel-text" style={{ width: "85%", height: "1.2rem" }} />
                    <div className="skel skel-text" style={{ width: "60%", height: "0.875rem", marginTop: "0.5rem" }} />
                    <div className="skel skel-text" style={{ width: "50%", height: "0.875rem", marginTop: "0.35rem" }} />
                    <div className="skel skel-text" style={{ width: "80px", height: "1.5rem", marginTop: "0.75rem" }} />
                    <div style={{ marginTop: "auto", paddingTop: "0.85rem" }}>
                      <div className="skel skel-btn" style={{ width: "100%", height: "42px" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
