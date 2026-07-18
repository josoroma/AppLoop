import { ParticleField } from "../components/particle-field";

const signals = [
  { label: "Ring layers", value: "18", className: "home-signal-ring-layers" },
  { label: "Laser colors", value: "4", className: "home-signal-laser-colors" },
  { label: "Motion field", value: "360°", className: "home-signal-motion-field" },
];

export default function Home() {
  return (
    <main className="homepage-shell particles-homepage-shell" data-builder-component="ParticlesHomePage" data-builder-id="particles-homepage">
      <ParticleField />
      <section className="homepage-hero particles-hero-section" data-builder-component="ParticlesHero" data-builder-id="particles-hero-section">
        <div className="homepage-copy particles-hero-copy">
          <p className="homepage-eyebrow particles-hero-eyebrow">Native WebGL · spinning laser rings</p>
          <h1 className="homepage-title particles-hero-title">A dark homepage wrapped in luminous concentric motion.</h1>
          <p className="homepage-summary particles-hero-summary">Blue, pink, purple, and white laser arcs rotate in layered circles against a deep cinematic background. The effect is rendered with a native WebGL shader, keeping the template lightweight and dependency-free.</p>
          <div className="homepage-actions particles-hero-actions" data-builder-id="particles-hero-actions">
            <a className="homepage-primary-action particles-primary-action" href="/demo">Watch demo</a>
            <a className="homepage-secondary-action particles-secondary-action" href="/docs">Read system notes</a>
          </div>
        </div>
        <aside className="homepage-orb-card particles-orb-card" data-builder-id="particles-orb-card">
          <div className="homepage-orb particles-status-orb" />
          <p className="homepage-orb-label particles-orb-label">Concentric laser geometry for launch pages, AI tools, and cinematic product systems.</p>
        </aside>
      </section>

      <section className="homepage-signal-grid particles-signal-grid" data-builder-id="particles-signal-grid">
        {signals.map((signal) => (
          <article className={`homepage-signal-card summary-card ${signal.className}`} data-builder-id={signal.className} key={signal.label}>
            <p className={`homepage-signal-label ${signal.className}-label`}>{signal.label}</p>
            <strong className={`homepage-signal-value ${signal.className}-value`}>{signal.value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
