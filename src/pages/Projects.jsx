import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react'
import { db, deleteProject } from '../db/db.js'
import { pluralize, todayIso } from '../lib/format.js'
import { PageHeader } from '../components/PageHeader.jsx'
import { Button, ConfirmDialog, EmptyState, useToast } from '../components/ui/index.js'
import { ProjectCard, ProjectCardSkeleton } from '../components/projects/ProjectCard.jsx'
import { ProjectDialog } from '../components/projects/ProjectDialog.jsx'
import { splitProjects, summarizeProjects } from '../components/projects/projectUtils.js'

const DESCRIPTION = 'Samla noterna för varje konsert i rätt ordning.'

export default function Projects() {
  const navigate = useNavigate()
  const toast = useToast()

  const projects = useLiveQuery(() => db.projects.toArray(), [], null)
  const links = useLiveQuery(() => db.projectScores.toArray(), [], null)
  const scores = useLiveQuery(() => db.scores.toArray(), [], null)
  // The page remounts on navigation (Shell keys <main> by pathname), so a fixed "today" is fine.
  const [today] = useState(todayIso)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null) // project
  const [deleting, setDeleting] = useState(null) // project
  const [deleteBusy, setDeleteBusy] = useState(false)

  const summaries = useMemo(() => summarizeProjects(links || [], scores || []), [links, scores])
  const groups = useMemo(() => (projects ? splitProjects(projects, today) : null), [projects, today])

  const loading = projects === null
  const isEmpty = projects !== null && projects.length === 0

  const openEdit = (project) => setEditing(project)
  const perform = (project) => navigate(`/projekt/${project.id}/spela`)

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteProject(deleting.id)
      toast.success('Projektet togs bort')
      setDeleting(null)
    } catch {
      toast.error('Projektet kunde inte tas bort. Försök igen.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const description = loading ? 'Läser in dina projekt…' : isEmpty ? DESCRIPTION : `${DESCRIPTION} ${pluralize(projects.length, 'projekt', 'projekt')}${groups.upcoming.length ? `, ${groups.upcoming.length} kommande` : ''}.`

  return (
    <div className="pb-6 animate-fade-in">
      <PageHeader
        eyebrow="Projekt"
        title="Konserter & projekt"
        description={description}
        actions={
          isEmpty ? null : (
            <Button onClick={() => setCreating(true)} data-testid="new-project">
              <Plus className="size-[18px]" aria-hidden="true" />
              Nytt projekt
            </Button>
          )
        }
      />

      <div className="px-4 sm:px-6 md:px-10">
        {loading ? (
          <ul className="mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Läser in projekt">
            {[0, 1, 2].map((i) => (
              <ProjectCardSkeleton key={i} index={i} />
            ))}
          </ul>
        ) : isEmpty ? (
          <EmptyState
            icon={CalendarDays}
            title="Inga projekt ännu"
            description="Ett projekt är en konsert, en audition eller ett program. Lägg till stycken ur biblioteket, ordna dem och framför hela setlistan från skärmen."
          >
            <Button size="lg" onClick={() => setCreating(true)} data-testid="new-project">
              <Plus className="size-5" aria-hidden="true" />
              Nytt projekt
            </Button>
          </EmptyState>
        ) : (
          <>
            <ProjectGroup title="Kommande" count={groups.upcoming.length}>
              {groups.upcoming.length ? (
                groups.upcoming.map((p) => <ProjectCard key={p.id} project={p} summary={summaries.get(p.id)} onEdit={openEdit} onPerform={perform} onDelete={setDeleting} />)
              ) : (
                <li className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-ivory-50/12 px-5 py-4 text-[15px] text-ivory-400">
                  <span className="flex items-center gap-2">
                    <CalendarPlus className="size-5 text-gold-400/80" aria-hidden="true" />
                    Inga kommande konserter inplanerade.
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                    Planera nästa
                  </Button>
                </li>
              )}
            </ProjectGroup>
            {groups.past.length ? (
              <ProjectGroup title="Tidigare" count={groups.past.length}>
                {groups.past.map((p) => (
                  <ProjectCard key={p.id} project={p} summary={summaries.get(p.id)} past onEdit={openEdit} onPerform={perform} onDelete={setDeleting} />
                ))}
              </ProjectGroup>
            ) : null}
          </>
        )}
      </div>

      <ProjectDialog open={creating} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/projekt/${p.id}`)} />
      <ProjectDialog open={!!editing} project={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => (deleteBusy ? null : setDeleting(null))}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Ta bort projektet?"
        message={deleting ? `”${deleting.name}” och dess setlista tas bort. Noterna ligger kvar i biblioteket och påverkas inte.` : ''}
        confirmLabel="Ta bort projekt"
      />
    </div>
  )
}

function ProjectGroup({ title, count, children }) {
  return (
    <section className="mt-8" aria-label={title}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-display text-2xl text-ivory-50">{title}</h2>
        <span className="text-sm tabular-nums text-ivory-500">{count}</span>
      </div>
      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  )
}
