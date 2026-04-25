import "./globals.css";

export default function RootLoading() {
  return (
    <main className="page">
      <section className="hero" style={{ minHeight: "min(72svh, 760px)" }}>
        <div className="container hero-grid" style={{ alignItems: "center" }}>
          <div style={{ maxWidth: "40rem", display: "grid", gap: "1rem" }}>
            <div className="skel skel-text" style={{ width: "9rem", height: "0.95rem", borderRadius: "999px" }} />
            <div className="skel skel-text" style={{ width: "100%", maxWidth: "32rem", height: "4.8rem", borderRadius: "24px" }} />
            <div className="skel skel-text" style={{ width: "78%", maxWidth: "26rem", height: "1.4rem" }} />
            <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", marginTop: "0.5rem" }}>
              <div className="skel skel-btn" style={{ width: "10rem", height: "3.2rem", borderRadius: "999px" }} />
              <div className="load-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
          <div className="skel skel-text" style={{ width: "15rem", height: "2rem" }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "28px",
                  overflow: "hidden",
                  background: "var(--surface)",
                }}
              >
                <div className="skel" style={{ width: "100%", aspectRatio: "1 / 1" }} />
                <div style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
                  <div className="skel skel-text" style={{ width: "72%", height: "1.35rem" }} />
                  <div className="skel skel-text" style={{ width: "90%", height: "0.95rem" }} />
                  <div className="skel skel-btn" style={{ width: "100%", height: "2.8rem", borderRadius: "18px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
