export default function AdminSeoLoading() {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "200px", height: "1.85rem" }} />
          <div className="skel skel-text" style={{ width: "340px", height: "0.95rem", marginTop: "0.4rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "160px", height: "40px" }} />
      </div>

      <div className="admin-stat-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-stat-card" style={{ borderLeftColor: "var(--border)" }}>
            <div className="admin-stat-card__body">
              <div className="skel skel-text" style={{ width: "80px", height: "0.82rem" }} />
              <div className="skel skel-text" style={{ width: "48px", height: "1.65rem", marginTop: "0.35rem" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "48px", borderRadius: "8px" }} />
          ))}
        </div>
      </div>
    </>
  );
}
