export default function AdminUserDetailLoading() {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "220px", height: "1.85rem" }} />
          <div className="skel skel-text" style={{ width: "360px", height: "0.95rem", marginTop: "0.4rem" }} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div className="skel skel-btn" style={{ width: "120px", height: "40px" }} />
          <div className="skel skel-btn" style={{ width: "140px", height: "40px" }} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="admin-review-item">
              <div className="skel skel-text" style={{ width: "80px", height: "0.8rem" }} />
              <div className="skel skel-text" style={{ width: "140px", height: "1.1rem", marginTop: "0.55rem" }} />
            </div>
          ))}
        </div>
      </div>

      <div className="admin-stat-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-stat-card" style={{ borderLeftColor: "var(--border)" }}>
            <div className="admin-stat-card__body">
              <div className="skel skel-text" style={{ width: "88px", height: "0.82rem" }} />
              <div className="skel skel-text" style={{ width: "60px", height: "1.65rem", marginTop: "0.35rem" }} />
            </div>
          </div>
        ))}
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="admin-card">
          <div className="skel skel-text" style={{ width: "220px", height: "1.1rem", marginBottom: "1rem" }} />
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="skel skel-text" style={{ width: "100%", height: "46px", borderRadius: "10px" }} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
