import Link from "next/link";

export function NotFoundView() {
  return (
    <main className="not-found-view admin-not-found-page" data-builder-component="NotFoundView" data-builder-id="not-found-view">
      <section className="not-found-card admin-not-found-card" data-builder-id="not-found-card">
        <div className="not-found-copy-group admin-not-found-copy-group">
          <p className="eyebrow not-found-eyebrow admin-not-found-eyebrow">404</p>
          <h1 className="not-found-title admin-not-found-title">This admin route is not ready yet.</h1>
          <p className="not-found-copy admin-not-found-copy">Use this reusable state for dashboard sections that are still being generated.</p>
          <div className="not-found-actions admin-not-found-actions" data-builder-id="not-found-actions">
            <Link className="not-found-action-link not-found-overview-link" href="/">Back to overview</Link>
            <Link className="not-found-action-link not-found-settings-link" href="/settings">Open settings</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
