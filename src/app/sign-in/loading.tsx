import "../create-account/create-account.css";

export default function SignInLoading() {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card--signin">
        <div className="auth-card__panel auth-card__panel--form">
          <div className="load-center" style={{ minHeight: "420px" }}>
            <div style={{ display: "grid", justifyItems: "center", gap: "1rem", width: "100%", maxWidth: "22rem" }}>
              <div className="load-spinner" aria-hidden />
              <div className="skel skel-text" style={{ width: "12rem", height: "1.7rem" }} />
              <div className="skel skel-text" style={{ width: "17rem", maxWidth: "100%", height: "1rem" }} />
              <div className="skel skel-btn" style={{ width: "100%", height: "3rem", borderRadius: "16px" }} />
              <div className="skel skel-btn" style={{ width: "100%", height: "3rem", borderRadius: "16px" }} />
              <div className="skel skel-btn" style={{ width: "100%", height: "3rem", borderRadius: "16px" }} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
