type CardRowsProps = {
  rows?: number;
};

export function AdminTableLoading({ rows = 6 }: CardRowsProps) {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "13rem", height: "2rem" }} />
          <div className="skel skel-text" style={{ width: "26rem", maxWidth: "100%", height: "0.95rem", marginTop: "0.5rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "10rem", height: "2.6rem" }} />
      </div>

      <div className="admin-card">
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "3.1rem", borderRadius: "14px" }} />
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminStatsAndTableLoading({ rows = 5 }: CardRowsProps) {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "12rem", height: "2rem" }} />
          <div className="skel skel-text" style={{ width: "18rem", height: "0.95rem", marginTop: "0.5rem" }} />
        </div>
        <div className="load-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-review-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-review-item">
              <div className="skel skel-text" style={{ width: "7rem", height: "0.8rem" }} />
              <div className="skel skel-text" style={{ width: "4rem", height: "1.5rem", marginTop: "0.45rem" }} />
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "3.2rem", borderRadius: "14px" }} />
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminEditorLoading() {
  return (
    <>
      <p className="admin-lead">
        <span className="skel skel-text" style={{ width: "8rem", height: "0.95rem", display: "inline-block" }} />
      </p>

      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "10rem", height: "2rem" }} />
          <div className="skel skel-text" style={{ width: "20rem", maxWidth: "100%", height: "0.95rem", marginTop: "0.45rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "9rem", height: "2.75rem" }} />
      </div>

      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-form-grid admin-form-grid--2">
          <div className="skel skel-text" style={{ width: "100%", height: "3rem", borderRadius: "14px" }} />
          <div className="skel skel-text" style={{ width: "100%", height: "3rem", borderRadius: "14px" }} />
        </div>
        <div className="skel skel-text" style={{ width: "100%", height: "7rem", borderRadius: "18px", marginTop: "1rem" }} />
      </div>

      <div className="admin-card" style={{ display: "grid", gap: "1rem" }}>
        <div className="skel skel-text" style={{ width: "12rem", height: "1.4rem" }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "18px", padding: "1rem", background: "var(--surface-muted, var(--surface))" }}>
            <div className="admin-form-grid admin-form-grid--2">
              <div className="skel skel-text" style={{ width: "100%", height: "3rem", borderRadius: "14px" }} />
              <div className="skel skel-text" style={{ width: "100%", height: "3rem", borderRadius: "14px" }} />
            </div>
            <div className="skel skel-text" style={{ width: "100%", height: "6rem", borderRadius: "16px", marginTop: "0.9rem" }} />
          </div>
        ))}
        <div className="load-center" style={{ paddingTop: "0.5rem" }}>
          <div className="load-spinner" aria-hidden />
        </div>
      </div>
    </>
  );
}

export function AdminDetailLoading() {
  return (
    <>
      <div className="admin-dash-head">
        <div>
          <div className="skel skel-text" style={{ width: "12rem", height: "2rem" }} />
          <div className="skel skel-text" style={{ width: "24rem", maxWidth: "100%", height: "0.95rem", marginTop: "0.5rem" }} />
        </div>
        <div className="skel skel-btn" style={{ width: "9rem", height: "2.6rem" }} />
      </div>

      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-review-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-review-item">
              <div className="skel skel-text" style={{ width: "6rem", height: "0.8rem" }} />
              <div className="skel skel-text" style={{ width: "8rem", height: "1.15rem", marginTop: "0.45rem" }} />
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ display: "grid", gap: "1rem" }}>
        <div className="skel skel-text" style={{ width: "10rem", height: "1.3rem" }} />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skel skel-text" style={{ width: "100%", height: i === 0 ? "8rem" : "12rem", borderRadius: "18px" }} />
        ))}
      </div>
    </>
  );
}
