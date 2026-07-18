const metrics = [
  { label: "Revenue", value: "$128.4K", change: "+12.8%", className: "metric-revenue" },
  { label: "Active users", value: "24,891", change: "+9.4%", className: "metric-active-users" },
  { label: "Conversion", value: "7.82%", change: "+1.1%", className: "metric-conversion" },
  { label: "Open issues", value: "18", change: "-6", className: "metric-open-issues" },
];

const activity = [
  { label: "New enterprise workspace created", className: "activity-enterprise-workspace" },
  { label: "Usage anomaly resolved", className: "activity-usage-anomaly" },
  { label: "Billing sync completed", className: "activity-billing-sync" },
  { label: "Team invited 8 members", className: "activity-team-invite" },
];

export default function Home() {
  return (
    <main className="admin-page admin-home-page" data-builder-component="AdminHomePage" data-builder-id="admin-home-page">
      <section className="admin-hero dashboard-page-header admin-home-hero" data-builder-component="AdminHero" data-builder-id="admin-hero">
        <div className="hero-copy-group admin-hero-copy-group">
          <p className="eyebrow dashboard-page-logo admin-hero-eyebrow">Luma admin</p>
          <h1 className="hero-title admin-hero-title">Operate the workspace from one quiet command center.</h1>
        </div>
        <a className="primary-link dashboard-header-primary-link admin-hero-primary-link" data-builder-id="admin-primary-action" href="/reports">
          View reports
        </a>
      </section>

      <section className="metric-grid dashboard-content dashboard-page-content admin-metrics-grid" data-builder-id="admin-metrics">
        {metrics.map((metric) => (
          <article className={`metric-card summary-card ${metric.className}`} data-builder-id={metric.className} key={metric.label}>
            <p className={`metric-label ${metric.className}-label`}>{metric.label}</p>
            <strong className={`metric-value ${metric.className}-value`}>{metric.value}</strong>
            <span className={`metric-change ${metric.className}-change`}>{metric.change}</span>
          </article>
        ))}
      </section>

      <section className="admin-panels admin-home-panels" data-builder-id="admin-panels">
        <article className="panel-card activity-panel admin-activity-panel" data-builder-id="admin-activity-panel">
          <h2 className="panel-title activity-panel-title">Recent activity</h2>
          <ul className="activity-list admin-activity-list">
            {activity.map((item) => (
              <li className={`activity-list-item ${item.className}`} key={item.label}>{item.label}</li>
            ))}
          </ul>
        </article>
        <article className="panel-card accent-panel health-panel admin-health-panel" data-builder-id="admin-health-panel">
          <h2 className="panel-title health-panel-title">System health</h2>
          <p className="panel-copy health-panel-copy">All core services are responsive. Review queues and integrations before the next deployment window.</p>
        </article>
      </section>
    </main>
  );
}
