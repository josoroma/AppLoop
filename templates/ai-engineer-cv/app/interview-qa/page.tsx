import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";

const qaPairs = [
  {
    question: "Tell me about yourself.",
    answer: "I’m a Senior Software Engineer and Product Owner specializing in agentic AI systems, local-first infrastructure, and modern web applications. My main stack includes Next.js, TypeScript, Node.js, Python, LangChain, and the Next.js AI SDK. Beyond implementation, I work across the full product lifecycle: defining requirements, designing architecture, prioritizing delivery, establishing acceptance criteria, and taking products from concept to production. I’m particularly interested in building AI systems that are secure, observable, maintainable, and directly connected to business value.",
    className: "qa-tell-me-about-yourself",
  },
  {
    question: "What are you currently working on?",
    answer: "I’m currently working as an AI Software Engineer at ImagineX Studio, where I focus on agent-driven applications and local-first AI infrastructure. My work includes designing agent orchestration flows, integrating language models and external tools, building Next.js interfaces for AI workflows, creating backend services in Python and Node.js, and improving deployment, observability, and developer experience.",
    className: "qa-currently-working-on",
  },
  {
    question: "Why are you looking for a new opportunity?",
    answer: "I’m looking for a role where I can have broader ownership over AI products and technical direction. I’m especially interested in teams building agentic systems, AI platforms, developer tools, or infrastructure where I can contribute both as a senior engineer and as someone capable of translating business needs into executable technical plans. I’m not simply looking for a change of technology. I’m looking for a role with meaningful product ownership, complex engineering challenges, and the opportunity to build systems that reach production and create measurable value.",
    className: "qa-new-opportunity",
  },
  {
    question: "Why did you leave Shell?",
    answer: "My experience at Shell gave me a strong foundation in enterprise software engineering, platform reliability, API integration, CI/CD, and collaboration across large teams. I moved toward AI-focused work because I wanted to specialize more deeply in agentic applications, language-model infrastructure, and product development. The transition allowed me to work closer to emerging AI technologies while taking greater ownership of architecture and product execution.",
    className: "qa-leaving-shell",
  },
  {
    question: "What type of role are you looking for?",
    answer: "I’m targeting Senior Software Engineer, AI Engineer, Agentic AI Engineer, Technical Product Engineer, or hands-on Technical Lead roles. The best fit would involve a combination of software architecture, AI agent development, backend and frontend engineering, product ownership, and technical leadership.",
    className: "qa-role-looking-for",
  },
  {
    question: "What makes you different from other senior engineers?",
    answer: "My main differentiator is that I operate across both product and engineering. I can discuss user needs, requirements, priorities, risks, and acceptance criteria, and then translate those decisions into system architecture and production code. I’m comfortable moving between product strategy, backend systems, AI orchestration, frontend experiences, infrastructure, testing, and deployment. That allows me to reduce the gap between what the business requests and what the engineering team ultimately delivers.",
    className: "qa-different-from-senior-engineers",
  },
  {
    question: "What is your experience with agentic AI?",
    answer: "I design systems in which models do more than generate text. They reason through tasks, select tools, call APIs, inspect results, maintain state, and continue working through iterative loops. I have experience designing flows such as prompt, action, observation, and reflection, as well as handling sessions, tool execution, structured outputs, context management, failure recovery, and human approval. I also focus on the engineering concerns around agents, including observability, determinism, security boundaries, cost control, model selection, local deployment, and production reliability.",
    className: "qa-agentic-ai-experience",
  },
  {
    question: "What does local-first AI infrastructure mean in your work?",
    answer: "Local-first AI infrastructure means designing applications so that models, data, or core workflows can run on infrastructure controlled by the organization or user rather than depending entirely on an external provider. This can improve privacy, resilience, cost control, latency, and operational independence. It can include local models, self-hosted inference, private vector databases, local project files, and controlled integrations with external services when necessary.",
    className: "qa-local-first-ai-infrastructure",
  },
  {
    question: "Are you more of a frontend or backend engineer?",
    answer: "My experience is full stack, but my strongest value is in system design and integration. On the frontend, I work primarily with Next.js, React, TypeScript, and AI-focused interfaces. On the backend, I use Python, Node.js, APIs, databases, agent frameworks, and infrastructure tooling. I’m comfortable owning the complete flow from the user interface to agent orchestration, external integrations, persistence, and deployment.",
    className: "qa-frontend-or-backend",
  },
  {
    question: "What is your experience with product ownership?",
    answer: "I define product requirements, user stories, workflows, technical specifications, delivery priorities, and acceptance criteria. I also help determine what should be built first, identify technical and product risks, divide large initiatives into implementation phases, and ensure that the final result solves the intended user problem. My product ownership style is highly technical and execution-oriented. I stay involved from initial discovery through implementation, testing, release, and iteration.",
    className: "qa-product-ownership",
  },
  {
    question: "How do you prioritize work?",
    answer: "I evaluate work based on business impact, user value, technical risk, dependencies, implementation effort, and how much uncertainty it removes. I prefer delivering vertical slices that prove the complete workflow rather than building isolated components without validating the product experience. For AI projects, I also prioritize early validation of model quality, tool reliability, data access, latency, cost, and failure behavior because those factors can determine whether the overall product is viable.",
    className: "qa-prioritize-work",
  },
  {
    question: "How do you handle unclear requirements?",
    answer: "I start by identifying the user, the problem being solved, the expected outcome, and how success will be measured. Then I turn the request into explicit workflows, constraints, assumptions, edge cases, and acceptance criteria. I document unresolved decisions and recommend a practical initial scope. My objective is to eliminate ambiguity before it becomes expensive code while still moving quickly enough to validate the product.",
    className: "qa-unclear-requirements",
  },
  {
    question: "Describe your leadership experience.",
    answer: "I have led through architecture decisions, code reviews, technical planning, mentoring, documentation, and delivery coordination. I help engineers understand not only what to implement but why a particular approach is appropriate. I focus on maintainable solutions, clear interfaces, incremental delivery, and making technical decisions visible to the team. My leadership style is hands-on. I’m comfortable setting direction while also contributing directly to implementation.",
    className: "qa-leadership-experience",
  },
  {
    question: "How do you mentor other engineers?",
    answer: "I use code reviews, pair programming, architecture discussions, and practical documentation. I try to explain the reasoning behind recommendations rather than simply requesting changes. I focus on helping engineers improve how they break down problems, evaluate tradeoffs, test assumptions, and design maintainable systems.",
    className: "qa-mentor-engineers",
  },
  {
    question: "What is your experience with CI/CD?",
    answer: "I have built and maintained GitHub Actions pipelines covering linting, static analysis, security checks, automated tests, coverage, builds, and deployments across development, staging, and production environments. I treat CI/CD as part of the product rather than only an operational concern. A good pipeline should make releases repeatable, detect defects early, reduce manual work, and give engineers clear feedback when something fails.",
    className: "qa-cicd-experience",
  },
  {
    question: "How do you ensure software quality?",
    answer: "I combine automated testing, type safety, linting, code reviews, clear API contracts, observability, and incremental releases. For AI systems, traditional tests are not sufficient, so I also validate structured outputs, tool selection, failure modes, prompt behavior, model regressions, latency, token usage, and response quality. I try to make failures diagnosable rather than merely preventing every possible failure.",
    className: "qa-software-quality",
  },
  {
    question: "How do you approach system design?",
    answer: "I begin with the required workflows, scale, security boundaries, data ownership, latency expectations, reliability requirements, and operational constraints. I then define the main components, interfaces, data flows, persistence strategy, failure behavior, and observability requirements. I prefer the simplest architecture that meets the real constraints, while leaving clear extension points for capabilities that are likely to evolve.",
    className: "qa-system-design",
  },
  {
    question: "How do you deal with production incidents?",
    answer: "I first stabilize the system and reduce user impact. Then I collect evidence through logs, traces, metrics, deployment history, and reproducible scenarios. After resolving the immediate issue, I document the root cause and improve the system through tests, alerts, validation, deployment safeguards, or architectural changes. I avoid treating incidents as isolated mistakes. They usually expose a weakness in the system or process that should be corrected.",
    className: "qa-production-incidents",
  },
  {
    question: "What are your salary expectations?",
    answer: "I’m looking for compensation that reflects the scope of the role, the level of ownership, and the market for senior AI and software engineering positions. I would prefer to understand the responsibilities, expectations, team structure, and total compensation package before giving a precise number. I’m open to discussing a range that is aligned with the company’s budget and the value expected from the role.",
    className: "qa-salary-expectations",
  },
  {
    question: "Are you open to hybrid or remote work?",
    answer: "Yes. I’m based in Costa Rica and open to hybrid or remote roles. I’m comfortable collaborating with distributed teams and working across time zones, provided there is clear communication, reasonable overlap, and effective documentation.",
    className: "qa-hybrid-remote-work",
  },
  {
    question: "What is your English level?",
    answer: "I use English professionally for technical documentation, architecture discussions, code reviews, tickets, meetings, and collaboration with international teams. I’m comfortable participating in technical interviews and working in an English-speaking environment.",
    className: "qa-english-level",
  },
  {
    question: "What are your main strengths?",
    answer: "My strongest areas are system architecture, full-stack execution, agentic AI, API design, product ownership, and translating ambiguous ideas into structured delivery plans. I’m also strong at identifying integration risks, improving developer workflows, documenting technical decisions, and taking ownership of complex projects.",
    className: "qa-main-strengths",
  },
  {
    question: "What is one area you are improving?",
    answer: "I naturally tend to go deeply into architecture and implementation details. I’ve learned to adjust the level of detail to the audience and stage of the project. Early in a project, I now focus more deliberately on validating the core user value and reducing uncertainty before optimizing the full architecture.",
    className: "qa-area-improving",
  },
  {
    question: "Describe a challenging project.",
    answer: "One challenging category of project has been building AI applications that combine a conversational interface, agent orchestration, external tools, project state, local model execution, and production deployment. The difficulty is not only calling a model. The system must coordinate state, context, tool permissions, retries, structured responses, user approvals, and observable execution. My approach is to separate the orchestration layer, model provider layer, tool interfaces, persistence, and user-facing execution timeline so that each part can be tested and evolved independently.",
    className: "qa-challenging-project",
  },
  {
    question: "How do you explain technical concepts to nontechnical stakeholders?",
    answer: "I explain them in terms of user impact, business risk, cost, timelines, and tradeoffs. Instead of focusing first on frameworks or infrastructure, I describe what the system will enable, what could fail, what decisions are reversible, and what evidence we need before investing further.",
    className: "qa-nontechnical-stakeholders",
  },
  {
    question: "Why should we hire you?",
    answer: "You should hire me if you need someone who can take ownership of an AI product from requirements through production. I bring senior-level engineering experience, hands-on agentic AI knowledge, full-stack implementation skills, product ownership, and an understanding of production concerns such as security, observability, CI/CD, maintainability, and cost. I can contribute directly to code while also helping the team make better architectural and product decisions.",
    className: "qa-why-hire-you",
  },
];

export default function InterviewQaPage() {
  return (
    <main className="cv-subpage-layout cv-interview-qa-page" data-builder-component="InterviewQaPage" data-builder-id="cv-interview-qa-page">
      <aside className="cv-subpage-sidebar cv-interview-qa-sidebar" data-builder-id="cv-interview-qa-sidebar">
        <div className="cv-subpage-sidebar-inner cv-interview-qa-sidebar-inner" data-builder-id="cv-interview-qa-sidebar-inner">
          <Link className="cv-subpage-back-link cv-interview-qa-back-link" data-builder-id="cv-interview-qa-back-link" href="/">
            <ArrowLeft className="cv-subpage-back-icon cv-interview-qa-back-icon" />
            <span className="cv-subpage-back-text cv-interview-qa-back-text">Back to CV</span>
          </Link>
          <div className="cv-subpage-sidebar-header cv-interview-qa-sidebar-header" data-builder-id="cv-interview-qa-sidebar-header">
            <MessageSquareText className="cv-subpage-sidebar-icon cv-interview-qa-sidebar-icon" />
            <h1 className="cv-subpage-title cv-interview-qa-title">Interview Q&A</h1>
          </div>
          <p className="cv-subpage-sidebar-desc cv-interview-qa-sidebar-desc">Structured answers for HR screens, recruiter calls, and senior AI engineering interviews.</p>
        </div>
      </aside>

      <section className="cv-subpage-main cv-interview-qa-main" data-builder-id="cv-interview-qa-main">
        {qaPairs.map((item, index) => (
          <article className={`cv-qa-card cv-interview-qa-card ${item.className}`} data-builder-id={item.className} key={item.className}>
            <h2 className={`cv-qa-question cv-interview-qa-question ${item.className}-question`}>{index + 1}. {item.question}</h2>
            <p className={`cv-qa-answer cv-interview-qa-answer ${item.className}-answer`}>{item.answer}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
