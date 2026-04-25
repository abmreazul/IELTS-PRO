import "./create-account.css";

export default function CreateAccountLoading() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card__panel auth-card__panel--form">
          <div style={{ display: "grid", gap: "1rem", maxWidth: "34rem", margin: "0 auto" }}>
            <div className="load-dots" aria-hidden style={{ justifyContent: "center" }}>
              <span />
              <span />
              <span />
            </div>
            <div className="skel skel-text" style={{ width: "14rem", height: "1.9rem", margin: "0 auto" }} />
            <div className="skel skel-text" style={{ width: "18rem", height: "1rem", margin: "0 auto" }} />
            <div className="skel skel-btn" style={{ width: "100%", height: "3rem", borderRadius: "16px" }} />
            <div className="skel skel-btn" style={{ width: "100%", height: "3rem", borderRadius: "16px" }} />
            <div className="skel skel-btn" style={{ width: "100%", height: "8rem", borderRadius: "20px" }} />
            <div className="skel skel-btn" style={{ width: "12rem", height: "3rem", borderRadius: "999px", marginLeft: "auto" }} />
          </div>
        </div>
      </section>
    </main>
  );
}
