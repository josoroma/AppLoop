export default function Home() {
  const experiences = [
    {
      role: "Principal Software Engineer",
      company: "Amazon Web Services",
      dates: "Jan 2022 – Present · 4 yrs 8 mos",
      location: "Seattle, WA",
      description: "Leading architecture for distributed ML serving infrastructure powering inference at petabyte scale. Built serverless GPU orchestration reducing cold-start latency by 68%.",
      className: "cv-experience-aws",
      logo: "AWS",
    },
    {
      role: "Senior Software Engineer",
      company: "Microsoft Azure",
      dates: "Mar 2019 – Dec 2021 · 2 yrs 10 mos",
      location: "Redmond, WA",
      description: "Designed and shipped Azure Container Apps networking layer. Drove adoption of gRPC service mesh across 12 internal teams, improving inter-service latency by 40%.",
      className: "cv-experience-azure",
      logo: "MS",
    },
    {
      role: "Software Engineer II",
      company: "Stripe",
      dates: "Jun 2016 – Feb 2019 · 2 yrs 9 mos",
      location: "San Francisco, CA",
      description: "Core payments infrastructure. Built real-time fraud detection pipeline processing 5M+ transactions/day. Led migration from monolith to event-driven microservices.",
      className: "cv-experience-stripe",
      logo: "ST",
    },
  ];

  const education = [
    {
      degree: "M.S. Computer Science",
      school: "Stanford University",
      dates: "2014 – 2016",
      description: "Focus in distributed systems and machine learning. Graduate thesis on efficient consensus protocols for geo-replicated datastores.",
      className: "cv-education-stanford",
      logo: "SU",
    },
    {
      degree: "B.S. Computer Science & Mathematics",
      school: "UC Berkeley",
      dates: "2010 – 2014",
      description: "EECS honors program. Undergrad research in randomized algorithms. Teaching assistant for CS 170 (Algorithms).",
      className: "cv-education-berkeley",
      logo: "Cal",
    },
  ];

  const skills = [
    { name: "TypeScript", className: "cv-skill-typescript" },
    { name: "React / Next.js", className: "cv-skill-react" },
    { name: "Python", className: "cv-skill-python" },
    { name: "Go", className: "cv-skill-go" },
    { name: "Rust", className: "cv-skill-rust" },
    { name: "Kubernetes", className: "cv-skill-kubernetes" },
    { name: "AWS / GCP", className: "cv-skill-cloud" },
    { name: "PostgreSQL", className: "cv-skill-postgres" },
    { name: "GraphQL", className: "cv-skill-graphql" },
    { name: "Kafka", className: "cv-skill-kafka" },
    { name: "Terraform", className: "cv-skill-terraform" },
    { name: "MLOps", className: "cv-skill-mlops" },
  ];

  return (
    <main className="app-shell cv-page-root cv-lumacv-home" data-builder-component="CVHome" data-builder-id="cv-home-page">
      {/* Profile Header */}
      <section className="cv-profile-header cv-profile-card" data-builder-component="ProfileHeader" data-builder-id="cv-profile-header">
        <div className="cv-profile-cover cv-cover-background" data-builder-id="cv-profile-cover" />
        <div className="cv-profile-header-inner" data-builder-id="cv-profile-header-inner">
          <div className="cv-profile-avatar-wrapper" data-builder-id="cv-profile-avatar-wrapper">
            <div className="cv-profile-avatar cv-profile-avatar-main" data-builder-id="cv-profile-avatar">
              <span className="cv-profile-avatar-fallback cv-profile-avatar-main-fallback">JR</span>
            </div>
          </div>
          <div className="cv-profile-meta" data-builder-id="cv-profile-meta">
            <h1 className="cv-profile-name cv-profile-name-main" data-builder-id="cv-profile-name">Joso R.</h1>
            <p className="cv-profile-headline cv-profile-headline-main" data-builder-id="cv-profile-headline">Principal Software Engineer — Distributed Systems, AI Infrastructure &amp; Cloud-Native Platforms</p>
            <p className="cv-profile-location cv-profile-location-main" data-builder-id="cv-profile-location">San Francisco Bay Area · 8,400+ followers · 500+ connections</p>
            <div className="cv-profile-actions" data-builder-id="cv-profile-actions">
              <button className="cv-profile-btn cv-profile-btn-primary cv-profile-action-open" type="button">Open to</button>
              <button className="cv-profile-btn cv-profile-btn-outline cv-profile-action-add" type="button">Add profile section</button>
              <button className="cv-profile-btn cv-profile-btn-outline cv-profile-action-more" type="button">More</button>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="cv-content-grid" data-builder-id="cv-content-grid">
        {/* Main content column */}
        <div className="cv-main-column" data-builder-id="cv-main-column">

          {/* About */}
          <section className="cv-section cv-about-section" data-builder-component="AboutSection" data-builder-id="cv-about-section">
            <h2 className="cv-section-title cv-about-title">About</h2>
            <p className="cv-about-text">
              Principal Software Engineer with 10+ years building large-scale distributed systems, cloud infrastructure, and ML platforms. Proven track record of leading cross-functional teams to ship resilient, high-throughput services powering millions of users. Passionate about developer experience, open-source, and mentoring the next generation of infrastructure engineers.
            </p>
          </section>

          {/* Experience */}
          <section className="cv-section cv-experience-section" data-builder-component="ExperienceSection" data-builder-id="cv-experience-section">
            <h2 className="cv-section-title cv-experience-title">Experience</h2>
            <div className="cv-cards-stack">
              {experiences.map((exp) => (
                <article className={`cv-card cv-experience-card summary-card ${exp.className}`} key={exp.className} data-builder-id={exp.className}>
                  <div className={`cv-card-logo cv-experience-logo ${exp.className}-logo`}>
                    <span className={`cv-card-logo-text ${exp.className}-logo-text`}>{exp.logo}</span>
                  </div>
                  <div className={`cv-card-body cv-experience-body ${exp.className}-body`}>
                    <h3 className={`cv-card-title cv-experience-role ${exp.className}-role`}>{exp.role}</h3>
                    <p className={`cv-card-subtitle cv-experience-company ${exp.className}-company`}>{exp.company}</p>
                    <p className={`cv-card-meta cv-experience-dates ${exp.className}-dates`}>{exp.dates}</p>
                    <p className={`cv-card-location cv-experience-location ${exp.className}-location`}>{exp.location}</p>
                    <p className={`cv-card-description cv-experience-description ${exp.className}-description`}>{exp.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="cv-section cv-education-section" data-builder-component="EducationSection" data-builder-id="cv-education-section">
            <h2 className="cv-section-title cv-education-title">Education</h2>
            <div className="cv-cards-stack">
              {education.map((edu) => (
                <article className={`cv-card cv-education-card summary-card ${edu.className}`} key={edu.className} data-builder-id={edu.className}>
                  <div className={`cv-card-logo cv-edu-logo ${edu.className}-logo`}>
                    <span className={`cv-card-logo-text ${edu.className}-logo-text`}>{edu.logo}</span>
                  </div>
                  <div className={`cv-card-body cv-edu-body ${edu.className}-body`}>
                    <h3 className={`cv-card-title cv-edu-degree ${edu.className}-degree`}>{edu.degree}</h3>
                    <p className={`cv-card-subtitle cv-edu-school ${edu.className}-school`}>{edu.school}</p>
                    <p className={`cv-card-meta cv-edu-dates ${edu.className}-dates`}>{edu.dates}</p>
                    <p className={`cv-card-description cv-edu-description ${edu.className}-description`}>{edu.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="cv-sidebar" data-builder-id="cv-sidebar">
          {/* Profile language */}
          <section className="cv-section cv-sidebar-section cv-languages-section" data-builder-id="cv-languages-section">
            <h2 className="cv-section-title cv-sidebar-title">Profile language</h2>
            <p className="cv-sidebar-text">English</p>
            <a className="cv-sidebar-link cv-languages-link" href="#">See translation options</a>
          </section>

          {/* Skills */}
          <section className="cv-section cv-sidebar-section cv-skills-section" data-builder-id="cv-skills-section">
            <h2 className="cv-section-title cv-sidebar-title">Top skills</h2>
            <div className="cv-skills-list">
              {skills.map((skill) => (
                <span className={`cv-skill-tag ${skill.className}`} key={skill.className}>{skill.name}</span>
              ))}
            </div>
          </section>

          {/* Contact info */}
          <section className="cv-section cv-sidebar-section cv-contact-section" data-builder-id="cv-contact-section">
            <h2 className="cv-section-title cv-sidebar-title">Contact info</h2>
            <div className="cv-contact-list">
              <div className="cv-contact-item cv-contact-item-linkedin" data-builder-id="cv-contact-linkedin">
                <span className="cv-contact-icon cv-contact-icon-linkedin">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                </span>
                <span className="cv-contact-label">linkedin.com/in/joso</span>
              </div>
              <div className="cv-contact-item cv-contact-item-website" data-builder-id="cv-contact-website">
                <span className="cv-contact-icon cv-contact-icon-website">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </span>
                <span className="cv-contact-label">joso.dev</span>
              </div>
              <div className="cv-contact-item cv-contact-item-github" data-builder-id="cv-contact-github">
                <span className="cv-contact-icon cv-contact-icon-github">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                </span>
                <span className="cv-contact-label">github.com/joso</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}