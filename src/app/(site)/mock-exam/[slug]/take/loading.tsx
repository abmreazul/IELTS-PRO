import "./exam-player.css";

export default function ExamTakeLoading() {
  return (
    <main className="exam-player">
      <div className="exam-shell">
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px", alignItems: "center", gap: "1rem", padding: "0.9rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
              <div className="load-spinner load-spinner--sm" aria-hidden />
              <div className="skel skel-text" style={{ width: "4rem", height: "1rem" }} />
            </div>
            <div className="skel" style={{ width: "100%", height: "0.5rem", borderRadius: "999px" }} />
            <div className="skel skel-btn" style={{ width: "8rem", height: "2.6rem", justifySelf: "end", borderRadius: "16px" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", minHeight: "calc(100svh - 88px)" }}>
          <section style={{ padding: "2rem 2rem 3rem" }}>
            <div style={{ maxWidth: "56rem", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
              <div className="skel skel-text" style={{ width: "14rem", height: "2rem" }} />
              <div className="skel skel-text" style={{ width: "20rem", height: "1rem" }} />
              <div className="skel skel-btn" style={{ width: "18rem", height: "3rem", borderRadius: "18px" }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "22px",
                    padding: "1.35rem",
                    background: "var(--surface)",
                    display: "grid",
                    gap: "1rem",
                  }}
                >
                  <div className="skel skel-text" style={{ width: `${88 - i * 8}%`, height: "1.35rem" }} />
                  <div className="skel skel-btn" style={{ width: "100%", height: "3.9rem", borderRadius: "18px" }} />
                  <div className="skel skel-btn" style={{ width: "100%", height: "3.9rem", borderRadius: "18px" }} />
                </div>
              ))}
            </div>
          </section>

          <aside style={{ borderLeft: "1px solid var(--border)", padding: "1.5rem", background: "var(--surface)" }}>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className="skel skel-text" style={{ width: "7rem", height: "1.1rem" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.65rem" }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="skel" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: "999px" }} />
                ))}
              </div>
              <div className="load-dots" aria-hidden style={{ justifyContent: "center", marginTop: "0.5rem" }}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
