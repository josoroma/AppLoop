type ProjectCardProps = {
  title: string
  description: string
}

export const ProjectCard = ({ title, description }: ProjectCardProps) => {
  return (
    <article className="project-card summary-card border-border bg-card text-card-foreground">
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  )
}