import Link from "next/link";
import { User, MapPin, Mail, Globe, Briefcase, Building2, Code2, Terminal, Server, Cloud, GitBranch, MessageSquareText, ClipboardList } from "lucide-react";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

const coreSkills = ["Agentic AI Systems", "Next.js AI SDK", "Python LangChain", "Node.js Express", "API Design", "CI/CD Pipelines"];
const interests = ["Agent architecture", "Systems design", "Developer experience", "Open-source tools"];

const experience = [
  {
    period: "Apr 2022 — Present · 4 yrs 4 mos",
    role: "AI Software Engineer",
    company: "ImagineX Studio — Costa Rica · Hybrid",
    className: "cv-experience-imaginex-studio",
  },
  {
    period: "Apr 2022 — Feb 2026 · 3 yrs 11 mos",
    role: "Senior Software Engineer",
    company: "Shell",
    className: "cv-experience-shell",
  },
];

const responsibilities = [
  { label: "Architecting and implementing agent-driven AI systems using Python, LangChain, and Node.js backends", className: "cv-responsibility-agentic-systems" },
  { label: "Building Next.js AI SDK frontends that orchestrate and visualize prompt → action → observation → reflection loops", className: "cv-responsibility-ai-sdk-frontends" },
  { label: "Designing, documenting, and integrating JSON-based APIs for internal platforms and third-party services", className: "cv-responsibility-api-design" },
  { label: "Leading GitHub Actions CI/CD pipelines for linting, code quality, security analysis, tests, coverage, build, and deploy", className: "cv-responsibility-cicd-pipelines" },
  { label: "Improving deployment reliability, automation, observability, and developer experience", className: "cv-responsibility-devex-reliability" },
  { label: "Mentoring engineers through code reviews, architecture guidance, and practical engineering best practices", className: "cv-responsibility-mentoring" },
];

const professionalSkills = [
  { label: "Next.js", level: 5, icon: <Globe className="cv-skill-icon cv-skill-nextjs-icon" />, className: "cv-skill-nextjs" },
  { label: "TypeScript", level: 5, icon: <Terminal className="cv-skill-icon cv-skill-typescript-icon" />, className: "cv-skill-typescript" },
  { label: "Python", level: 5, icon: <Terminal className="cv-skill-icon cv-skill-python-icon" />, className: "cv-skill-python" },
  { label: "Node.js", level: 5, icon: <Server className="cv-skill-icon cv-skill-nodejs-icon" />, className: "cv-skill-nodejs" },
  { label: "LangChain", level: 4, icon: <Server className="cv-skill-icon cv-skill-langchain-icon" />, className: "cv-skill-langchain" },
  { label: "Docker", level: 4, icon: <Cloud className="cv-skill-icon cv-skill-docker-icon" />, className: "cv-skill-docker" },
  { label: "GitHub Actions", level: 4, icon: <GitBranch className="cv-skill-icon cv-skill-github-actions-icon" />, className: "cv-skill-github-actions" },
];

const guideLinks = [
  {
    href: "/interview-qa",
    title: "Interview Q&A",
    description: "Answers for recruiter, HR, and technical-product screening conversations.",
    icon: <MessageSquareText className="cv-guide-link-icon cv-guide-interview-icon" />,
    className: "cv-guide-interview-qa",
  },
  {
    href: "/hr-questions",
    title: "Questions for HR",
    description: "Questions to ask about ownership, AI maturity, team structure, compensation, and success criteria.",
    icon: <ClipboardList className="cv-guide-link-icon cv-guide-hr-icon" />,
    className: "cv-guide-hr-questions",
  },
];

export default function Home() {
  return (
    <main className="cv-page-layout" data-builder-component="AiEngineerCvPage" data-builder-id="ai-engineer-cv-page">
      <div className="cv-glow-orb-tl" aria-hidden="true" />
      <div className="cv-glow-orb-br" aria-hidden="true" />
      <div className="cv-glow-orb-cr" aria-hidden="true" />
      <aside className="cv-sidebar cv-profile-sidebar" data-builder-id="cv-profile-sidebar">
        <div className="cv-profile-header cv-sidebar-profile-header" data-builder-id="cv-sidebar-profile-header">
          <Avatar className="cv-profile-avatar cv-sidebar-avatar" data-builder-id="cv-sidebar-avatar">
            <AvatarFallback className="cv-profile-avatar-fallback cv-sidebar-avatar-fallback">
              <User className="size-8 cv-sidebar-avatar-user-icon" data-builder-id="cv-sidebar-avatar-user-icon" />
            </AvatarFallback>
          </Avatar>
          <div className="cv-profile-text cv-sidebar-profile-text" data-builder-id="cv-sidebar-profile-text">
            <h1 className="cv-profile-name cv-sidebar-profile-name">Jose Pablo Orozco Marin</h1>
            <p className="cv-profile-tagline cv-sidebar-profile-tagline">Senior Software Engineer & Product Owner | Agentic AI & Local-First Infrastructure</p>
          </div>
        </div>

        <div className="cv-contact-list cv-sidebar-contact-list" data-builder-id="cv-sidebar-contact-list">
          <span className="cv-contact-row cv-sidebar-contact-row-location" data-builder-id="cv-sidebar-contact-row-location"><MapPin className="cv-contact-icon cv-sidebar-location-icon" /><span className="cv-contact-label cv-sidebar-contact-label-location">Costa Rica · Hybrid</span></span>
          <span className="cv-contact-row cv-sidebar-contact-row-email" data-builder-id="cv-sidebar-contact-row-email"><Mail className="cv-contact-icon cv-sidebar-email-icon" /><span className="cv-contact-label cv-sidebar-contact-label-email">josoroma@example.com</span></span>
          <span className="cv-contact-row cv-sidebar-contact-row-website" data-builder-id="cv-sidebar-contact-row-website"><Globe className="cv-contact-icon cv-sidebar-website-icon" /><span className="cv-contact-label cv-sidebar-contact-label-website">josoroma.com</span></span>
        </div>

        <section className="cv-sidebar-section cv-core-skills-section" data-builder-id="cv-core-skills-section">
          <h2 className="cv-sidebar-heading cv-core-skills-heading">Core skills</h2>
          <ul className="cv-tag-list cv-core-skills-list">
            {coreSkills.map((skill) => {
              const className = `cv-core-skill-${skill.toLowerCase().replaceAll(" ", "-").replaceAll(".", "").replaceAll("/", "-")}`;

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
          <p className="cv-main-text cv-executive-text">I’m a Senior Software Engineer, product owner, and problem solver specializing in agentic AI systems, local-first AI infrastructure, and modern web platforms. Using Next.js, the AI SDK, Node.js, TypeScript, and Python, I take products from concept to execution by defining requirements, user stories, technical architecture, delivery priorities, and measurable acceptance criteria. I build production-grade applications that combine agent orchestration, secure integrations, local model deployment, and intuitive user experiences, with a strong focus on scalability, maintainability, privacy, observability, and business value.</p>
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

        <section className="cv-main-section cv-key-responsibilities" data-builder-id="cv-key-responsibilities">
          <h2 className="cv-main-heading cv-responsibilities-heading"><Server className="cv-section-icon cv-responsibilities-icon" /> Key responsibilities & strengths</h2>
          <ul className="cv-responsibility-list cv-key-responsibility-list">
            {responsibilities.map((item) => (
              <li className={`cv-responsibility-item ${item.className}`} data-builder-id={item.className} key={item.className}>{item.label}</li>
            ))}
          </ul>
        </section>

        <section className="cv-main-section cv-interview-guide-section" data-builder-id="cv-interview-guide-section">
          <h2 className="cv-main-heading cv-interview-guide-heading"><MessageSquareText className="cv-section-icon cv-interview-guide-icon" /> Interview guide</h2>
          <div className="cv-guide-links cv-interview-guide-links" data-builder-id="cv-interview-guide-links">
            {guideLinks.map((link) => (
              <Link className={`cv-guide-link ${link.className}`} data-builder-id={link.className} href={link.href} key={link.href}>
                <span className={`cv-guide-link-icon-wrap ${link.className}-icon-wrap`}>{link.icon}</span>
                <span className={`cv-guide-link-body ${link.className}-body`}>
                  <span className={`cv-guide-link-title ${link.className}-title`}>{link.title}</span>
                  <span className={`cv-guide-link-description ${link.className}-description`}>{link.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="cv-main-section cv-professional-skills" data-builder-id="cv-professional-skills">
          <h2 className="cv-main-heading cv-professional-skills-heading"><Code2 className="cv-section-icon cv-professional-skills-icon" /> Professional skills</h2>
          <div className="cv-skill-indicators cv-professional-skill-indicators" data-builder-id="cv-professional-skill-indicators">
            {professionalSkills.map((skill) => (
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
