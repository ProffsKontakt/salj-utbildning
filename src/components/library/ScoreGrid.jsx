import { ScoreCard, ScoreCardSkeleton } from './ScoreCard.jsx'

const EMPTY = []
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'

/**
 * Responsive grid of score cards. Pass `scores = null` to render skeletons.
 * `projectsByScore` is a Map<scoreId, project[]>.
 */
export function ScoreGrid({ scores, projectsByScore, onOpen, onPages, onAddToProject, onEdit, onDelete, skeletonCount = 8 }) {
  if (scores === null) {
    return (
      <ul className={GRID} aria-busy="true" aria-label="Läser in noter">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <ScoreCardSkeleton key={i} index={i} />
        ))}
      </ul>
    )
  }
  return (
    <ul className={GRID} aria-label="Noter">
      {scores.map((score) => (
        <ScoreCard
          key={score.id}
          score={score}
          projects={projectsByScore?.get(score.id) || EMPTY}
          onOpen={onOpen}
          onPages={onPages}
          onAddToProject={onAddToProject}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
