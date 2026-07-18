import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

const hrQuestions = [
  "How is this role divided between hands-on engineering, architecture, leadership, and product responsibilities?",
  "What problem is the company expecting this person to solve during the first six months?",
  "Is the AI functionality already in production, in development, or still at the experimentation stage?",
  "How does the organization evaluate the quality and business impact of its AI systems?",
  "What level of ownership would I have over architecture and technical decisions?",
  "How are product, engineering, data, security, and infrastructure teams organized?",
  "What are the most important technical challenges the team is currently facing?",
  "Does the company primarily use hosted models, self-hosted models, or a combination of both?",
  "What are the expectations regarding availability, time-zone overlap, hybrid attendance, and on-call responsibilities?",
  "What does success look like for this role after 30, 90, and 180 days?",
  "What is the interview process, and which areas will each stage evaluate?",
  "What is the approved compensation range and total benefits package for the position?",
];

export default function HrQuestionsPage() {
  return (
    <main className="cv-subpage-layout cv-hr-questions-page" data-builder-component="HrQuestionsPage" data-builder-id="cv-hr-questions-page">
      <aside className="cv-subpage-sidebar cv-hr-questions-sidebar" data-builder-id="cv-hr-questions-sidebar">
        <div className="cv-subpage-sidebar-inner cv-hr-questions-sidebar-inner" data-builder-id="cv-hr-questions-sidebar-inner">
          <Link className="cv-subpage-back-link cv-hr-questions-back-link" data-builder-id="cv-hr-questions-back-link" href="/">
            <ArrowLeft className="cv-subpage-back-icon cv-hr-questions-back-icon" />
            <span className="cv-subpage-back-text cv-hr-questions-back-text">Back to CV</span>
          </Link>
          <div className="cv-subpage-sidebar-header cv-hr-questions-sidebar-header" data-builder-id="cv-hr-questions-sidebar-header">
            <ClipboardList className="cv-subpage-sidebar-icon cv-hr-questions-sidebar-icon" />
            <h1 className="cv-subpage-title cv-hr-questions-title">Questions for HR</h1>
          </div>
          <p className="cv-subpage-sidebar-desc cv-hr-questions-sidebar-desc">Use these questions to understand ownership, AI maturity, team structure, expectations, and compensation before accepting a role.</p>
        </div>
      </aside>

      <section className="cv-subpage-main cv-hr-questions-main" data-builder-id="cv-hr-questions-main">
        <article className="cv-qa-card cv-hr-questions-card qa-hr-questions-list-card" data-builder-id="qa-hr-questions-list-card">
          <h2 className="cv-qa-question cv-hr-questions-heading qa-hr-questions-list-heading">Questions you should ask HR</h2>
          <ul className="cv-qa-hr-list cv-hr-questions-list">
            {hrQuestions.map((question, index) => {
              const className = `qa-hr-question-${index + 1}`;

              return (
                <li className={`cv-qa-hr-item ${className}`} data-builder-id={className} key={question}>
                  <span className={`cv-qa-hr-number ${className}-number`}>{index + 1}.</span>
                  <span className={`cv-qa-hr-text ${className}-text`}>{question}</span>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </main>
  );
}
