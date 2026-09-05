import { useState } from 'react'
import { updateScore } from '../../db/db.js'
import { Button, Dialog, TextArea, TextField, useToast } from '../ui/index.js'

/**
 * Edit title / composer / voice / key / notes of a score.
 * Props: { score: object|null, open, onClose }
 */
export function ScoreInfoDialog({ score, open, onClose }) {
  if (!open || !score) return null
  // Key by id so the form resets when a different score is edited.
  return <InfoForm key={score.id} score={score} onClose={onClose} />
}

function InfoForm({ score, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: score.title || '',
    composer: score.composer || '',
    voice: score.voice || '',
    key: score.key || '',
    notes: score.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const titleError = touched && !form.title.trim() ? 'Ange en titel.' : null

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const save = async (e) => {
    e?.preventDefault?.()
    setTouched(true)
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      const updated = await updateScore(score.id, {
        title: form.title.trim(),
        composer: form.composer.trim(),
        voice: form.voice.trim(),
        key: form.key.trim(),
        notes: form.notes,
      })
      if (!updated) toast.error('Stycket finns inte längre i biblioteket.')
      else toast.success('Informationen sparades')
      onClose?.()
    } catch {
      toast.error('Ändringarna kunde inte sparas. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      title="Redigera info"
      description="Titel och kompositör visas i biblioteket och i setlistor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button type="submit" form="score-info-form" loading={saving} data-testid="score-info-save">
            Spara
          </Button>
        </>
      }
    >
      <form id="score-info-form" onSubmit={save} className="space-y-4" data-testid="score-info-dialog">
        <TextField label="Titel" value={form.title} onChange={set('title')} onBlur={() => setTouched(true)} error={titleError} required autoComplete="off" data-testid="score-info-title" />
        <TextField label="Kompositör" value={form.composer} onChange={set('composer')} placeholder="t.ex. Franz Schubert" autoComplete="off" data-testid="score-info-composer" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Stämma" value={form.voice} onChange={set('voice')} placeholder="t.ex. Sopran" autoComplete="off" />
          <TextField label="Tonart" value={form.key} onChange={set('key')} placeholder="t.ex. F-dur" autoComplete="off" />
        </div>
        <TextArea label="Anteckningar" value={form.notes} onChange={set('notes')} rows={3} placeholder="Tempo, andning, textrader att komma ihåg…" />
      </form>
    </Dialog>
  )
}
