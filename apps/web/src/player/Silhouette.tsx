interface Props {
  className?: string;
}

/** Silhueta em CSS para quando não há arte nem retrato. Sem arquivo de imagem. */
export function Silhouette({ className }: Props) {
  return <div className={`silhouette ${className ?? ''}`.trim()} role="img" aria-label="Sem imagem" />;
}
