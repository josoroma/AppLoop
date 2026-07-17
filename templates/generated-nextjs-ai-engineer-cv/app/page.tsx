import { User, MapPin, Mail, Globe, Briefcase, Building2, GraduationCap, Code2, Terminal, Server, Cloud, GitBranch } from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

const coreSkills = ["LLM systems", "Applied ML", "MLOps", "RAG pipelines"];
const interests = ["Agent architecture", "Decision science", "Open-source ML", "Authoring tools"];

const experience = [
  {
    period: "2024 — present",
    role: "Staff AI Engineer",
    company: "Frontier Labs",
    className: "cv-experience-frontier-labs",
  },
  {
    period: "2021 — 2024",
    role: "Senior ML Engineer",
    company: "SignalWorks",
    className: "cv-experience-signalworks",
  },
  {
    period: "2018 — 2021",
    role: "Data Scientist",
    company: "Northstar AI",
    className: "cv-experience-northstar-ai",
  },
];

const education = [
  { period: "2015 — 2017", degree: "M.S. Machine Learning", school: "Carnegie Mellon University", className: "cv-education-cmu" },
  { period: "2011 — 2015", degree: "B.S. Computer Science", school: "UC Berkeley", className: "cv-education-berkeley" },
];

export default function Home() {
  return (
    <main className="cv-page-layout" data-builder-component="AiEngineerCvPage" data-builder-id="ai-engineer-cv-page">
      <aside className="cv-sidebar cv-profile-sidebar" data-builder-id="cv-profile-sidebar">
        <div className="cv-profile-header cv-sidebar-profile-header" data-builder-id="cv-sidebar-profile-header">
          <Avatar className="cv-profile-avatar cv-sidebar-avatar" data-builder-id="cv-sidebar-avatar">
            <AvatarFallback className="cv-profile-avatar-fallback cv-sidebar-avatar-fallback">
              <User className="size-8 text-muted-foreground/70 cv-sidebar-avatar-user-icon" data-builder-id="cv-sidebar-avatar-user-icon" />
            </AvatarFallback>
          </Avatar>
          <div className="cv-profile-text cv-sidebar-profile-text">
            <h1 className="cv-profile-name cv-sidebar-profile-name">Joso R.</h1>
            <p className="cv-profile-tagline cv-sidebar-profile-tagline">AI engineering builder</p>
          </div>
        </div>

        <div className="cv-contact-list cv-sidebar-contact-list" data-builder-id="cv-sidebar-contact-list">
          <span className="cv-contact-row cv-sidebar-contact-row-location" data-builder-id="cv-sidebar-contact-row-location"><MapPin className="cv-contact-icon cv-sidebar-contact-icon" /><span className="cv-contact-label cv-sidebar-contact-label-location">San Francisco · Remote</span></span>
          <span className="cv-contact-row cv-sidebar-contact-row-email" data-builder-id="cv-sidebar-contact-row-email"><Mail className="cv-contact-icon cv-sidebar-contact-icon" /><span className="cv-contact-label cv-sidebar-contact-label-email">josoroma@example.com</span></span>
          <span className="cv-contact-row cv-sidebar-contact-row-website" data-builder-id="cv-sidebar-contact-row-website"><Globe className="cv-contact-icon cv-sidebar-contact-icon" /><span className="cv-contact-label cv-sidebar-contact-label-website">josoroma.com</span></span>
        </div>

        <section className="cv-sidebar-section cv-core-skills-section" data-builder-id="cv-core-skills-section">
          <h2 className="cv-sidebar-heading cv-core-skills-heading">Core skills</h2>
          <ul className="cv-tag-list cv-core-skills-list">
            {coreSkills.map((skill) => {
              const className = `cv-core-skill-${skill.toLowerCase().replaceAll(" ", "-")}`;

              return <li className={`cv-tag-item cv-core-skill-item ${className}`} data-builder-id={className} key={skill}>{skill}</li>;
            })}
          </ul>
        </section>

        <section className="cv-sidebar-section cv-interests-section" data-builder-id="cv-interests-section">
          <h2 className="cv-sidebar-heading cv-interests-heading">Interests</h2>
          <ul className="cv-tag-list cv-interests-list">
            {interests.map((interest) => {
              const className = `cv-interest-${interest.toLowerCase().replaceAll(" ", "-")}`;

              return <li className={`cv-tag-item cv-interest-item ${className}`} data-builder-id={className} key={interest}>{interest}</li>;
            })}
          </ul>
        </section>
      </aside>

      <main className="cv-main-panel" data-builder-id="cv-main-panel">
        <section className="cv-main-section cv-executive-profile" data-builder-id="cv-executive-profile">
          <h2 className="cv-main-heading cv-executive-heading"><Briefcase className="cv-section-icon cv-executive-icon" /> Executive profile</h2>
          <p className="cv-main-text cv-executive-text">Senior AI engineer with 9 years across LLM applications, applied ML platforms, and measurable product outcomes. Fluent in model evaluation, systems design, and cross-functional execution. I build agentic tooling that teams actually adopt — from prototype to production.</p>
        </section>

        <section className="cv-main-section cv-professional-experience" data-builder-id="cv-professional-experience">
          <h2 className="cv-main-heading cv-experience-heading"><Building2 className="cv-section-icon cv-experience-icon" /> Professional experience</h2>
          <div className="cv-timeline cv-experience-timeline" data-builder-id="cv-experience-timeline">
            {experience.map((item) => (
              <article className={`cv-timeline-entry ${item.className}`} data-builder-id={item.className} key={item.company}>
                <div className={`cv-timeline-marker ${item.className}-marker`} aria-hidden />
                <div className={`cv-timeline-body ${item.className}-body`}>
                  <p className={`cv-timeline-period ${item.className}-period`}>{item.period}</p>
                  <h3 className={`cv-timeline-role ${item.className}-role`}>{item.role}</h3>
                  <p className={`cv-timeline-company ${item.className}-company`}>{item.company}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cv-main-section cv-education-section" data-builder-id="cv-education-section">
          <h2 className="cv-main-heading cv-education-heading"><GraduationCap className="cv-section-icon cv-education-icon" /> Education</h2>
          <div className="cv-timeline cv-education-timeline" data-builder-id="cv-education-timeline">
            {education.map((item) => (
              <article className={`cv-timeline-entry ${item.className}`} data-builder-id={item.className} key={item.degree}>
                <div className={`cv-timeline-marker ${item.className}-marker`} aria-hidden />
                <div className={`cv-timeline-body ${item.className}-body`}>
                  <p className={`cv-timeline-period ${item.className}-period`}>{item.period}</p>
                  <h3 className={`cv-timeline-role ${item.className}-degree`}>{item.degree}</h3>
                  <p className={`cv-timeline-company ${item.className}-school`}>{item.school}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cv-main-section cv-professional-skills" data-builder-id="cv-professional-skills">
          <h2 className="cv-main-heading cv-professional-skills-heading"><Code2 className="cv-section-icon cv-professional-skills-icon" /> Professional skills</h2>
          <div className="cv-skill-indicators cv-professional-skill-indicators" data-builder-id="cv-professional-skill-indicators">
            {[
              { label: "TypeScript", level: 5, icon: <Terminal className="cv-skill-icon cv-skill-ts-icon" />, className: "cv-skill-typescript" },
              { label: "Python", level: 5, icon: <Terminal className="cv-skill-icon cv-skill-python-icon" />, className: "cv-skill-python" },
              { label: "Next.js", level: 5, icon: <Globe className="cv-skill-icon cv-skill-next-icon" />, className: "cv-skill-nextjs" },
              { label: "PyTorch", level: 4, icon: <Server className="cv-skill-icon cv-skill-pytorch-icon" />, className: "cv-skill-pytorch" },
              { label: "Docker", level: 4, icon: <Cloud className="cv-skill-icon cv-skill-docker-icon" />, className: "cv-skill-docker" },
              { label: "Kubernetes", level: 3, icon: <Cloud className="cv-skill-icon cv-skill-k8s-icon" />, className: "cv-skill-kubernetes" },
              { label: "Git & CI/CD", level: 4, icon: <GitBranch className="cv-skill-icon cv-skill-git-icon" />, className: "cv-skill-git" },
            ].map((skill) => (
              <div className={`cv-skill-row ${skill.className}`} data-builder-id={skill.className} key={skill.label}>
                <span className={`cv-skill-label-row ${skill.className}-label-row`}>
                  <span className={`cv-skill-label-icon ${skill.className}-icon-wrapper`}>{skill.icon}</span>
                  <span className={`cv-skill-label-text ${skill.className}-label`}>{skill.label}</span>
                </span>
                <div className={`cv-skill-bar-track ${skill.className}-track`} role="progressbar" aria-valuenow={skill.level} aria-valuemin={0} aria-valuemax={5} aria-label={`${skill.label} proficiency ${skill.level} of 5`}>
                  <div className={`cv-skill-bar-fill ${skill.className}-fill`} style={{ width: `${skill.level * 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </main>
  );
}