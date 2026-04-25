export default function ReviewResultsLoading() {
  return (
    <main className="page" style={{ padding: "3rem 1.5rem" }}>
      <div className="container" style={{ maxWidth: "42rem", display: "grid", gap: "1rem" }}>
        <div className="skel skel-text" style={{ width: "12rem", height: "2rem" }} />
        <div className="skel skel-text" style={{ width: "18rem", height: "1rem" }} />
        <div className="load-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "1rem",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                display: "grid",
                gap: "0.6rem",
              }}
            >
              <div className="skel skel-text" style={{ width: "5rem", height: "0.8rem" }} />
              <div className="skel skel-text" style={{ width: "4rem", height: "1.5rem" }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
