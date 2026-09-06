// Local (camelCase, ms timestamps) ⇄ cloud (snake_case, ISO timestamps).

export const REMOTE_TABLE = { scores: 'scores', projects: 'projects', projectScores: 'project_scores', annotations: 'annotations' }
export const PUSH_ORDER = ['scores', 'projects', 'projectScores', 'annotations'] // foreign-key order
export const PULL_ORDER = ['scores', 'projects', 'projectScores', 'annotations']

export const toIso = (ms) => new Date(ms || 0).toISOString()
export const toMs = (iso) => (iso ? Date.parse(iso) : 0)

export function scoreToRemote(s, userId, { fileVersion, thumbVersion } = {}) {
  const row = {
    id: s.id,
    user_id: userId,
    title: s.title,
    composer: s.composer || '',
    voice: s.voice || '',
    key: s.key || '',
    notes: s.notes || '',
    page_count: s.pageCount,
    file_size: s.fileSize || 0,
    page_order: s.pageOrder || [],
    rotations: s.rotations || {},
    created_at: toIso(s.createdAt),
    updated_at: toIso(s.updatedAt),
    deleted_at: null,
  }
  if (fileVersion != null) row.file_version = fileVersion
  if (thumbVersion != null) row.thumb_version = thumbVersion
  return row
}

export function scoreFromRemote(r, local) {
  return {
    ...(local || {}),
    id: r.id,
    title: r.title,
    composer: r.composer || '',
    voice: r.voice || '',
    key: r.key || '',
    notes: r.notes || '',
    pageCount: r.page_count,
    fileSize: r.file_size || 0,
    pageOrder: Array.isArray(r.page_order) ? r.page_order : [],
    rotations: r.rotations && typeof r.rotations === 'object' ? r.rotations : {},
    createdAt: toMs(r.created_at) || local?.createdAt || Date.now(),
    updatedAt: toMs(r.updated_at),
    lastOpenedAt: local?.lastOpenedAt || 0,
    thumb: local?.thumb ?? null,
    thumbMime: 'image/jpeg',
    ownerId: r.user_id,
    dirty: 0,
    fileVersion: local?.fileVersion ?? r.file_version ?? 0,
    remoteFileVersion: local?.remoteFileVersion ?? 0,
    thumbVersion: local?.thumbVersion ?? 0,
    remoteThumbVersion: local?.remoteThumbVersion ?? 0,
  }
}

export function projectToRemote(p, userId) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    date: p.date || '',
    venue: p.venue || '',
    notes: p.notes || '',
    created_at: toIso(p.createdAt),
    updated_at: toIso(p.updatedAt),
    deleted_at: null,
  }
}

export function projectFromRemote(r, local) {
  return {
    ...(local || {}),
    id: r.id,
    name: r.name,
    date: r.date || '',
    venue: r.venue || '',
    notes: r.notes || '',
    createdAt: toMs(r.created_at) || local?.createdAt || Date.now(),
    updatedAt: toMs(r.updated_at),
    ownerId: r.user_id,
    dirty: 0,
  }
}

export function linkToRemote(l, userId) {
  return {
    id: l.id,
    user_id: userId,
    project_id: l.projectId,
    score_id: l.scoreId,
    position: l.position,
    updated_at: toIso(l.updatedAt),
    deleted_at: null,
  }
}

export function linkFromRemote(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    scoreId: r.score_id,
    position: r.position,
    updatedAt: toMs(r.updated_at),
    ownerId: r.user_id,
    dirty: 0,
  }
}

export function annotationToRemote(a, userId) {
  return {
    score_id: a.scoreId,
    page_index: a.pageIndex,
    user_id: userId,
    strokes: a.strokes || [],
    texts: a.texts || [],
    note: a.note || '',
    updated_at: toIso(a.updatedAt),
    deleted_at: null,
  }
}

export function annotationFromRemote(r) {
  return {
    scoreId: r.score_id,
    pageIndex: r.page_index,
    v: 1,
    strokes: Array.isArray(r.strokes) ? r.strokes : [],
    texts: Array.isArray(r.texts) ? r.texts : [],
    note: r.note || '',
    updatedAt: toMs(r.updated_at),
    dirty: 0,
  }
}

export const filePath = (userId, scoreId) => `${userId}/${scoreId}.pdf`
export const thumbPath = (userId, scoreId) => `${userId}/${scoreId}.thumb.jpg`
