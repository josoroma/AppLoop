import { NeonFieldScene } from '../components/neon-field-scene'

export default function Home() {
  return (
    <main
      className="immersive-shell immersive-full-screen-shell"
      data-builder-component="NeonFieldPage"
      data-builder-id="neon-field-page"
    >
      <section
        className="immersive-stage-region immersive-neon-stage-region"
        data-builder-id="immersive-neon-stage-region"
        aria-label="Immersive neon field"
      >
        <NeonFieldScene />
      </section>
    </main>
  )
}
