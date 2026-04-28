export default function AdminUsersLoading() {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "160px", height: "1.85rem" }} />
          <div className="skel skel-text" style={{ width: "280px", height: "0.95rem", marginTop: "0.4rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "140px", height: "40px" }} />
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="admin-review-item">
              <div className="skel skel-text" style={{ width: "90px", height: "0.8rem" }} />
              <div className="skel skel-text" style={{ width: "72px", height: "1.25rem", marginTop: "0.55rem" }} />
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "46px", borderRadius: "10px" }} />
          ))}
        </div>
      </div>
    </>
  );
}
