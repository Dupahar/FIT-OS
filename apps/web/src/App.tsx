export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">FIT Admin</p>
          <h1>Fitness SaaS Control Center</h1>
          <p className="app__sub">
            Bootstrapped MVP workspace. This dashboard will evolve into the
            tenant-aware operations console.
          </p>
        </div>
        <div className="app__pill">Phase 1: Foundations</div>
      </header>

      <section className="app__grid">
        <div className="card">
          <h2>Usage Ledger</h2>
          <p>Metering primitives and billable events are first-class.</p>
        </div>
        <div className="card">
          <h2>Tenant Isolation</h2>
          <p>Row-level security enforced by request-scoped tenant context.</p>
        </div>
        <div className="card">
          <h2>Outbox Events</h2>
          <p>Reliable async workflows for payments, WhatsApp, and devices.</p>
        </div>
      </section>
    </div>
  );
}
