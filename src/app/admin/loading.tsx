export default function AdminLoading() {
  return (
    <>
      {/* Header skeleton */}
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "220px", height: "1.85rem" }} />
          <div className="skel skel-text" style={{ width: "180px", height: "0.95rem", marginTop: "0.4rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "160px", height: "40px" }} />
      </div>

      {/* Stat cards skeleton */}
      <div className="admin-stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-stat-card" style={{ borderLeftColor: "var(--border)" }}>
            <div className="admin-stat-card__body">
              <div className="skel skel-text" style={{ width: "80px", height: "0.82rem" }} />
              <div className="skel skel-text" style={{ width: "60px", height: "1.65rem", marginTop: "0.35rem" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="admin-card">
        <div className="skel skel-text" style={{ width: "280px", height: "40px", borderRadius: "12px", marginBottom: "1rem" }} />
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "44px", borderRadius: "8px" }} />
          ))}
        </div>
      </div>
    </>
  );
}
