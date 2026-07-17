const findings = [
  { label: "Compression-aware retrieval", detail: "Segment-level memory improves synthesis fidelity when contexts exceed model windows.", className: "paper-finding-compression-retrieval" },
  { label: "Tool-grounded citations", detail: "Citation graphs reduce unsupported claims by making provenance explicit at paragraph level.", className: "paper-finding-tool-citations" },
  { label: "Evaluator disagreement", detail: "Human and model raters diverge most on novelty, not factuality, requiring rubric-specific calibration.", className: "paper-finding-evaluator-disagreement" },
];

const sections = [
  { title: "1. Problem framing", copy: "Deep research agents must gather, filter, synthesize, and verify evidence while maintaining an auditable chain from claim to source.", className: "paper-section-problem-framing" },
  { title: "2. Method", copy: "We compare recursive search, citation graph expansion, and evaluator-guided summarization across long-horizon research tasks.", className: "paper-section-method" },
  { title: "3. Implications", copy: "Research UX should expose uncertainty, source diversity, contradiction handling, and versioned synthesis artifacts.", className: "paper-section-implications" },
];

export default function Home() {
  return (
    <main className="paper-shell paper-page-shell" data-builder-component="DeepResearchPaperPage" data-builder-id="deep-research-paper-page">
      <article className="paper-document paper-research-document" data-builder-id="paper-research-document">
        <header className="paper-header paper-research-header" data-builder-id="paper-research-header">
          <p className="paper-kicker paper-research-kicker">Deep research systems · Working paper</p>
          <h1 className="paper-title paper-research-title">Evidence-Calibrated Deep Research Agents for Long-Horizon Knowledge Work</h1>
          <p className="paper-abstract paper-research-abstract">A template for research-heavy pages with citation-aware structure, dense typographic hierarchy, findings, methods, and implementation notes.</p>
          <div className="paper-meta-row paper-research-meta-row">
            <span className="paper-meta-item paper-meta-author">A. Researcher</span>
            <span className="paper-meta-item paper-meta-lab">AppLoop Research Lab</span>
            <span className="paper-meta-item paper-meta-date">July 2026</span>
          </div>
        </header>

        <section className="paper-summary paper-executive-summary" data-builder-id="paper-executive-summary">
          <h2 className="paper-section-title paper-summary-title">Executive summary</h2>
          <p className="paper-body-copy paper-summary-copy">The strongest deep research experiences combine broad retrieval, narrow verification, and visible synthesis artifacts. This template is designed for papers, memos, and research briefs that need structure before narrative flourish.</p>
        </section>

        <section className="paper-findings-grid paper-key-findings" data-builder-id="paper-key-findings">
          {findings.map((finding) => (
            <article className={`paper-finding-card summary-card ${finding.className}`} data-builder-id={finding.className} key={finding.label}>
              <h3 className={`paper-finding-title ${finding.className}-title`}>{finding.label}</h3>
              <p className={`paper-finding-copy ${finding.className}-copy`}>{finding.detail}</p>
            </article>
          ))}
        </section>

        <section className="paper-section-list paper-main-sections" data-builder-id="paper-main-sections">
          {sections.map((section) => (
            <section className={`paper-content-section ${section.className}`} data-builder-id={section.className} key={section.title}>
              <h2 className={`paper-section-heading ${section.className}-heading`}>{section.title}</h2>
              <p className={`paper-body-copy ${section.className}-copy`}>{section.copy}</p>
            </section>
          ))}
        </section>

        <aside className="paper-citation-panel paper-method-citations" data-builder-id="paper-method-citations">
          <h2 className="paper-section-title paper-citations-title">Citation protocol</h2>
          <p className="paper-body-copy paper-citations-copy">Every claim should map to a source cluster, confidence rating, and contradiction note. Use this sidebar for provenance rules or reviewer instructions.</p>
        </aside>
      </article>
    </main>
  );
}
