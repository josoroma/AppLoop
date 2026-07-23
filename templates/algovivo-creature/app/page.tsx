import { CreatureSidebar } from '../components/creature-sidebar'

export default function Home() {
  return (
    <main
      className="algovivo-shell creature-homepage-shell"
      data-builder-component="AlgovivoCreaturePage"
      data-builder-id="algovivo-creature-page"
    >
      <section
        className="algovivo-hero creature-hero-section"
        data-builder-id="algovivo-creature-hero"
        aria-label="Algovivo soft-bodied creature"
      >
        <CreatureSidebar />
      </section>
    </main>
  )
}
