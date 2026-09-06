import { useId, useState } from 'react'
import { createProject, updateProject } from '../../db/db.js'
import { Button, Dialog, TextArea, TextField, useToast } from '../ui/index.js'

/**
 * Create or edit a project. Pass `project` to edit, omit it to create.
 * `onSaved(project)` receives the stored record (create) or the patched record (edit).
 * The body is remounted on every open so the form always starts fresh.
 */
export function ProjectDialog({ open, onClose, project = null, onSaved }) {
  if (!open) return null
  return <ProjectDialogBody key={project?.id || 'new'} onClose={onClose} project={project} onSaved={onSaved} />
}

function ProjectDialogBody({ onClose, project, onSaved }) {
  const toast = useToast()
  const formId = useId()
  const isEdit = !!project
  const [name, setName] = useState(project?.name || '')
  const [date, setDate] = useState(project?.date || '')
  const [venue, setVenue] = useState(project?.venue || '')
  const [notes, setNotes] = useState(project?.notes || '')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const nameError = touched && !name.trim() ? 'Ge projektet ett namn.' : ''

  const submit = async (e) => {
    e?.preventDefault?.()
    if (busy) return
    if (!name.trim()) {
      setTouched(true)
      return
    }
    setBusy(true)
    try {
      const data = { name: name.trim(), date, venue: venue.trim(), notes: notes.trim() }
      let saved
      if (isEdit) {
        await updateProject(project.id, data)
        saved = { ...project, ...data }
      } else {
        saved = await createProject(data)
      }
      toast.success(isEdit ? 'Projektet uppdaterades' : 'Projektet skapades')
      onSaved?.(saved)
      onClose?.()
    } catch {
      toast.error('Projektet kunde inte sparas. Försök igen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      title={isEdit ? 'Redigera projekt' : 'Nytt projekt'}
      description={isEdit ? 'Ändra namn, datum eller plats för konserten.' : 'En konsert, en audition eller ett repertoarblock – samla noterna på ett ställe.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
          <Button type="submit" form={formId} loading={busy} data-testid="project-save">
            {isEdit ? 'Spara' : 'Skapa projekt'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
        <TextField
          label="Namn"
          required
          autoComplete="off"
          maxLength={120}
          placeholder="T.ex. Julkonsert i Storkyrkan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          error={nameError}
          data-testid="project-name"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Datum"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint={date ? undefined : 'Lämna tomt om datumet inte är bestämt.'}
            data-testid="project-date"
            inputClassName="min-w-0 [&::-webkit-date-and-time-value]:text-left"
          />
          <TextField label="Plats" autoComplete="off" maxLength={120} placeholder="Kyrka, scen, sal…" value={venue} onChange={(e) => setVenue(e.target.value)} data-testid="project-venue" />
        </div>
        <TextArea
          label="Anteckningar"
          rows={3}
          placeholder="Repetitionstider, klädsel, kontaktpersoner…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Dialog>
  )
}
