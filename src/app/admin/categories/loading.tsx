export default function CategoriesLoading() {
  return (
    <>
      <div className="skel skel-text" style={{ width: "160px", height: "1.65rem", marginBottom: "0.5rem" }} />
      <div className="skel skel-text" style={{ width: "280px", height: "0.95rem", marginBottom: "1.75rem" }} />

      <div className="admin-card">
        <div className="skel skel-text" style={{ width: "120px", height: "1.05rem", marginBottom: "1rem" }} />
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "40px", borderRadius: "10px" }} />
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="skel skel-text" style={{ width: "160px", height: "1.05rem", marginBottom: "1rem" }} />
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skel skel-text" style={{ width: "100%", height: "80px", borderRadius: "10px" }} />
          ))}
        </div>
      </div>
    </>
  );
}
