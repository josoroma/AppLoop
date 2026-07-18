# CV Template Subpages

## Overview

When adding subpages to the `ai-engineer-cv` template, use a consistent sidebar+main grid layout that mirrors the CV page's visual language. Subpages include Q&A cards, back-link navigation, and the same dark gradient sidebar styling.

## Layout Structure

```
.cv-subpage-layout          ← grid: 18rem sidebar + 1fr main, min-height: 100vh
  ├── .cv-subpage-sidebar   ← dark gradient sidebar (matches .cv-sidebar)
  │     └── .cv-subpage-sidebar-inner  ← sticky, padded
  │           ├── .cv-subpage-back-link   ← border-wrapped pill, arrow icon + "Back to CV"
  │           ├── .cv-subpage-sidebar-header  ← icon + gradient title
  │           └── .cv-subpage-sidebar-desc   ← muted description text
  └── .cv-subpage-main      ← padded content area, display: grid, gap: 1.25rem
        └── .cv-qa-card × N  ← glass-morphism cards (see below)
```

## Q&A Card Pattern

```css
.cv-qa-card         /* glass-morphism: bg oklch(1/3%), border oklch(1/6%), blur, hover darken */
  .cv-qa-question   /* uppercase, 0.84rem, 800 weight, border-bottom divider */
  .cv-qa-answer     /* 0.96rem, 1.8 line-height, var(--muted-foreground) */
```

## Unique Classname Convention

Every element gets a page-specific base classname PLUS a unique last classname for inspect-mode targeting:

- Page root: `cv-subpage-layout cv-about-page` → unique last: `cv-about-page`
- Sidebar: `cv-subpage-sidebar cv-about-sidebar`
- Back link: `cv-subpage-back-link cv-about-back-link`
- QA cards: `cv-qa-card cv-about-qa-card qa-about-myself` → unique last: `qa-about-myself`
- QA question: `cv-qa-question cv-about-qa-question qa-about-myself-question`
- QA answer: `cv-qa-answer cv-about-qa-answer qa-about-myself-answer`

## Data Model

```typescript
interface QAPair {
  question: string;
  answer: string;
  className: string;  // unique kebab-case, used as last classname
}
```

## Route Structure

Subpages go under routes like `/about`, `/interview-qa`, `/hr-questions`, etc. Each is a `page.tsx` in its own directory under `app/`. The layout.tsx (RootLayout) wraps all routes so no per-route layout is needed.

For interview-prep CVs, prefer two durable routes:

- `/interview-qa`: recruiter/HR/technical-product questions and answers rendered as `cv-qa-card` items.
- `/hr-questions`: questions the candidate should ask HR, rendered as a numbered list inside a `cv-qa-card`.

## HR Questions List

When displaying a numbered list (e.g., questions to ask HR), use:

```html
<ul class="cv-qa-hr-list">
  <li class="cv-qa-hr-item qa-hr-question-1">
    <span class="cv-qa-hr-number qa-hr-question-1-number">1.</span>
    <span class="cv-qa-hr-text qa-hr-question-1-text">...</span>
  </li>
</ul>
```

`.cv-qa-hr-number` gets accent color (`oklch(0.599 0.225 -64.449)`), `.cv-qa-hr-text` gets `var(--muted-foreground)`.

## CSS Location

All subpage styles go at the end of `app/globals.css`, after the main CV styles and before the print section. Include print overrides for `.cv-subpage-layout::before`, `.cv-subpage-sidebar`, and `.cv-qa-card`.

## Jose/Joso CV Content Pattern

For Jose Pablo Orozco Marin / Joso CV variants, base the homepage on the provided senior software engineer + product owner profile: agentic AI systems, local-first infrastructure, Next.js AI SDK, TypeScript, Node.js, Python, LangChain, API design, CI/CD, and Costa Rica hybrid/remote positioning. Add two subpages when requested:

- `/interview-qa`: recruiter/HR/technical-product interview questions and answers as `.cv-qa-card` entries.
- `/hr-questions`: a numbered `.cv-qa-hr-list` of questions to ask HR.

The sidebar avatar variant `.cv-sidebar-avatar-fallback` must use a black/dark gradient, not the older red/orange gradient. Because `.cv-profile-avatar-fallback` sets `background: transparent`, keep `.cv-sidebar-avatar-fallback` after the base rule so the variant wins the cascade.