type ProjectCardProps = {
  title: string
  description: string
  className?: string
}

export const ProjectCard = ({ title, description, className }: ProjectCardProps) => {
  const uniqueClassName = className ?? `project-card-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`

  return (
    <article className={`project-card summary-card border-border bg-card text-card-foreground ${uniqueClassName}`}>
      <h2 className={`project-card-title ${uniqueClassName}-title`}>{title}</h2>
      <p className={`project-card-description ${uniqueClassName}-description`}>{description}</p>
    </article>
  )
}
