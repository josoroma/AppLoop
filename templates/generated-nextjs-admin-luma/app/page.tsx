const metrics = [
  { label: "Revenue", value: "$128.4K", change: "+12.8%" },
  { label: "Active users", value: "24,891", change: "+9.4%" },
  { label: "Conversion", value: "7.82%", change: "+1.1%" },
  { label: "Open issues", value: "18", change: "-6" },
];

const activity = ["New enterprise workspace created", "Usage anomaly resolved", "Billing sync completed", "Team invited 8 members"];

export default function Home() {
  return (
    <main className="admin-page" data-builder-component="AdminHomePage" data-builder-id="admin-home-page">
      <section className="admin-hero dashboard-header" data-builder-component="AdminHero" data-builder-id="admin-hero">
        <div>
          <p className="eyebrow">Luma admin</p>
          <h1>Operate the workspace from one quiet command center.</h1>
        </div>
        <a className="primary-link" data-builder-id="admin-primary-action" href="/reports">
          View reports
        </a>
      </section>

      <section className="metric-grid dashboard-content" data-builder-id="admin-metrics">
        {metrics.map((metric) => (
          <article className="metric-card summary-card" data-builder-id={`metric-${metric.label.toLowerCase().replaceAll(" ", "-")}`} key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.change}</span>
          </article>
        ))}
      </section>

      <section className="admin-panels" data-builder-id="admin-panels">
        <article className="panel-card" data-builder-id="admin-activity-panel">
          <h2>Recent activity</h2>
          <ul>
            {activity.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="panel-card accent-panel" data-builder-id="admin-health-panel">
          <h2>System health</h2>
          <p>All core services are responsive. Review queues and integrations before the next deployment window.</p>
        </article>
      </section>
    </main>
  );
}