import Link from "next/link";

export function NotFoundView() {
  return (
    <main className="not-found-view" data-builder-component="NotFoundView" data-builder-id="not-found-view">
      <section className="not-found-card" data-builder-id="not-found-card">
        <div>
          <p className="eyebrow">404</p>
          <h1>This admin route is not ready yet.</h1>
          <p>Use this reusable state for dashboard sections that are still being generated.</p>
          <div className="not-found-actions" data-builder-id="not-found-actions">
            <Link href="/">Back to overview</Link>
            <Link href="/settings">Open settings</Link>
          </div>
        </div>
      </section>
    </main>
  );
}