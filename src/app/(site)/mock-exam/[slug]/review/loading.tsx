import "./review.css";

export default function ReviewResultsLoading() {
  return (
    <main className="rv">
      <div className="rv__inner">
        {/* Header skeleton */}
        <div className="rv__header">
          <div className="rv-skel" style={{ width: "10rem", height: "2rem" }} />
          <div className="rv-skel" style={{ width: "16rem", height: "1rem", marginTop: "0.5rem" }} />
        </div>

        {/* Band hero skeleton */}
        <div className="rv__band-hero" style={{ alignItems: "center" }}>
          <div className="rv-skel" style={{ width: "8rem", height: "0.8rem", background: "rgba(255,255,255,0.08)" }} />
          <div className="rv-skel" style={{ width: "5rem", height: "3rem", marginTop: "0.5rem", background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Module cards skeleton */}
        <div className="rv__modules">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rv__module-card" style={{ flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
              <div className="rv-skel" style={{ width: "4.5rem", height: "0.75rem" }} />
              <div className="rv-skel" style={{ width: "3rem", height: "1.3rem" }} />
            </div>
          ))}
        </div>

        {/* Writing section skeleton */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
            <div className="rv-skel" style={{ width: "44px", height: "44px", borderRadius: "12px" }} />
            <div>
              <div className="rv-skel" style={{ width: "12rem", height: "1rem", marginBottom: "0.35rem" }} />
              <div className="rv-skel" style={{ width: "10rem", height: "0.75rem" }} />
            </div>
          </div>

          {/* Summary skeleton */}
          <div style={{ padding: "1.15rem 1.25rem", borderRadius: "16px", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: "1rem" }}>
            <div className="rv-skel" style={{ width: "100%", height: "0.85rem", marginBottom: "0.5rem" }} />
            <div className="rv-skel" style={{ width: "90%", height: "0.85rem", marginBottom: "0.5rem" }} />
            <div className="rv-skel" style={{ width: "75%", height: "0.85rem" }} />
          </div>

          {/* Insights skeleton */}
          <div className="rv__insights">
            <div className="rv__insight-card">
              <div className="rv-skel" style={{ width: "5rem", height: "0.85rem", marginBottom: "0.65rem" }} />
              <div className="rv-skel" style={{ width: "100%", height: "0.75rem", marginBottom: "0.35rem" }} />
              <div className="rv-skel" style={{ width: "85%", height: "0.75rem" }} />
            </div>
            <div className="rv__insight-card">
              <div className="rv-skel" style={{ width: "7rem", height: "0.85rem", marginBottom: "0.65rem" }} />
              <div className="rv-skel" style={{ width: "100%", height: "0.75rem", marginBottom: "0.35rem" }} />
              <div className="rv-skel" style={{ width: "80%", height: "0.75rem" }} />
            </div>
          </div>

          {/* Task card skeleton */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rv__task-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <div className="rv-skel" style={{ width: "7rem", height: "1rem" }} />
                <div className="rv-skel" style={{ width: "4.5rem", height: "1.5rem", borderRadius: "999px" }} />
              </div>
              <div className="rv-skel" style={{ width: "4rem", height: "0.75rem", marginBottom: "1rem" }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ marginBottom: j < 3 ? "1rem" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <div className="rv-skel" style={{ width: "8rem", height: "0.75rem" }} />
                    <div className="rv-skel" style={{ width: "2rem", height: "0.75rem" }} />
                  </div>
                  <div className="rv-skel" style={{ width: "100%", height: "6px", borderRadius: "999px", marginBottom: "0.4rem" }} />
                  <div className="rv-skel" style={{ width: "90%", height: "0.7rem" }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Actions skeleton */}
        <div className="rv__actions">
          <div className="rv-skel" style={{ width: "8rem", height: "2.5rem", borderRadius: "12px" }} />
          <div className="rv-skel" style={{ width: "10rem", height: "2.5rem", borderRadius: "12px" }} />
        </div>
      </div>
    </main>
  );
}
