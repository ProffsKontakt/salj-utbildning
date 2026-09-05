// Edit title, composer, voice and key of a score.
import { useState } from 'react'
import { updateScore } from '../../db/db.js'
import { Dialog, Button, TextField, useToast } from '../ui/index.js'

function Form({ score, onClose }) {
  const toast = useToast()
  const [title, setTitle] = useState(score.title || '')
  const [composer, setComposer] = useState(score.composer || '')
  const [voice, setVoice] = useState(score.voice || '')
  const [key, setKey] = useState(score.key || '')
  const [saving, setSaving] = useState(false)
  const titleError = title.trim() ? '' : 'Ange en titel.'

  const save = async (e) => {
    e?.preventDefault?.()
    if (titleError || saving) return
    setSaving(true)
    try {
      await updateScore(score.id, { title: title.trim(), composer: composer.trim(), voice: voice.trim(), key: key.trim() })
      toast.success('Informationen sparades')
      onClose?.()
    } catch {
      toast.error('Kunde inte spara informationen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" data-testid="score-info-form">
      <TextField label="Titel" value={title} onChange={(e) => setTitle(e.target.value)} error={title.trim() ? '' : titleError} required autoComplete="off" data-testid="info-title" />
      <TextField label="Kompositör" value={composer} onChange={(e) => setComposer(e.target.value)} autoComplete="off" data-testid="info-composer" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Stämma" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Sopran, tenor…" autoComplete="off" />
        <TextField label="Tonart" value={key} onChange={(e) => setKey(e.target.value)} placeholder="D-dur, g-moll…" autoComplete="off" />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" type="button" onClick={onClose}>
          Avbryt
        </Button>
        <Button type="submit" loading={saving} disabled={!!titleError} data-testid="info-save">
          Spara
        </Button>
      </div>
    </form>
  )
}

/** @param {{ open:boolean, onClose:() => void, score:object|null }} p */
export function ScoreInfoDialog({ open, onClose, score }) {
  return (
    <Dialog open={open && !!score} onClose={onClose} title="Redigera info" description="Titel och kompositör visas i biblioteket och i exporterade PDF:er.">
      {score ? <Form key={score.id} score={score} onClose={onClose} /> : null}
    </Dialog>
  )
}
