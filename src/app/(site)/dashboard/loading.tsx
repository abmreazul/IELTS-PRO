export default function DashboardLoading() {
  return (
    <main className="page db">
      <div className="container">
        {/* Header skeleton */}
        <div className="db-header">
          <div>
            <div className="skel skel-text" style={{ width: "260px", height: "2rem" }} />
            <div
              className="skel skel-text"
              style={{ width: "200px", height: "0.9rem", marginTop: "0.5rem" }}
            />
          </div>
          <div className="skel" style={{ width: "140px", height: "42px", borderRadius: "10px" }} />
        </div>

        {/* Stats skeleton */}
        <div className="db-stats">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="db-stat">
              <div
                className="skel"
                style={{ width: "38px", height: "38px", borderRadius: "12px", marginBottom: "0.8rem" }}
              />
              <div className="skel skel-text" style={{ width: "60px", height: "1.5rem" }} />
              <div
                className="skel skel-text"
                style={{ width: "90px", height: "0.7rem", marginTop: "0.4rem" }}
              />
            </div>
          ))}
        </div>

        {/* Band bars skeleton */}
        <div className="db-band-overview">
          <div className="skel skel-text" style={{ width: "160px", height: "1rem", marginBottom: "1rem" }} />
          <div className="db-band-bars">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="db-band-bar">
                <div
                  className="skel skel-text"
                  style={{ width: "100%", height: "0.75rem" }}
                />
                <div
                  className="skel"
                  style={{ width: "100%", height: "8px", borderRadius: "999px" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Attempts skeleton */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="skel skel-text" style={{ width: "140px", height: "1rem", marginBottom: "1rem" }} />
          <div className="db-attempts">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="db-attempt" style={{ minHeight: "72px" }}>
                <div className="db-attempt__info">
                  <div className="skel skel-text" style={{ width: "180px", height: "0.85rem" }} />
                  <div
                    className="skel skel-text"
                    style={{ width: "120px", height: "0.65rem", marginTop: "0.35rem" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
