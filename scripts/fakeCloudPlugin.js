// Vite dev-server middleware that emulates the Notställ cloud (auth, tables,
// storage) in memory. Enabled only when NOTSTALL_FAKE_CLOUD=1 – used by the
// Playwright suite so multi-device sync can be tested without network access.
//
// Endpoints (all under /__cloud):
//   POST /auth/signin {email,password}            → { user }
//   GET  /pull?table&since&offset&limit           → rows (synced_at >= since, ascending)
//   POST /upsert {table, rows}                    → rows as stored
//   POST /delete {table, entries:[{key, deletedAt}]} → { updated }
//   PUT  /files/<path>  (raw body)                → { ok }
//   GET  /files/<path>                            → bytes
//   DELETE /files/<path>                          → { ok }
//   POST /reset                                   → clears everything (tests)
// Rows are scoped by the x-user header, mirroring row level security.

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function userIdFor(email) {
  return 'u_' + Buffer.from(String(email).trim().toLowerCase()).toString('base64url')
}

export function fakeCloudPlugin() {
  let clock = 0
  const tables = new Map() // table -> Map(key -> row)
  const files = new Map() // path -> { bytes, type }
  const keyOf = (table, row) => (table === 'annotations' ? `${row.score_id}:${row.page_index}` : row.id)
  const nextSyncedAt = () => new Date(Date.UTC(2030, 0, 1) + ++clock * 1000).toISOString()
  const tableMap = (t) => {
    if (!tables.has(t)) tables.set(t, new Map())
    return tables.get(t)
  }
  const json = (res, status, body) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }

  return {
    name: 'notstall-fake-cloud',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__cloud/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.slice('/__cloud'.length)
        const user = req.headers['x-user'] ? String(req.headers['x-user']) : null
        try {
          if (path === '/reset' && req.method === 'POST') {
            tables.clear()
            files.clear()
            return json(res, 200, { ok: true })
          }
          if (path === '/auth/signin' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}')
            if (!body.email || !body.password) return json(res, 400, { error: 'email and password required' })
            return json(res, 200, { user: { id: userIdFor(body.email), email: String(body.email).trim().toLowerCase(), provider: 'email', name: '' } })
          }
          if (!user) return json(res, 401, { error: 'not signed in' })

          if (path === '/pull' && req.method === 'GET') {
            const table = url.searchParams.get('table')
            const since = url.searchParams.get('since') || '1970-01-01T00:00:00.000Z'
            const offset = Number(url.searchParams.get('offset') || 0)
            const limit = Number(url.searchParams.get('limit') || 500)
            const rows = [...tableMap(table).values()]
              .filter((r) => r.user_id === user && r.synced_at >= since)
              .sort((a, b) => (a.synced_at < b.synced_at ? -1 : a.synced_at > b.synced_at ? 1 : String(keyOf(table, a)).localeCompare(String(keyOf(table, b)))))
              .slice(offset, offset + limit)
            return json(res, 200, rows)
          }
          if (path === '/upsert' && req.method === 'POST') {
            const { table, rows } = JSON.parse((await readBody(req)).toString())
            const map = tableMap(table)
            const out = []
            for (const row of rows) {
              if (row.user_id !== user) return json(res, 403, { error: 'row level security' })
              const key = keyOf(table, row)
              const prev = map.get(key)
              const merged = { ...(prev || {}), ...row, synced_at: nextSyncedAt() }
              map.set(key, merged)
              out.push(merged)
            }
            return json(res, 200, out)
          }
          if (path === '/delete' && req.method === 'POST') {
            const { table, entries } = JSON.parse((await readBody(req)).toString())
            const map = tableMap(table)
            let updated = 0
            for (const { key, deletedAt } of entries) {
              const k = typeof key === 'object' ? `${key.scoreId}:${key.pageIndex}` : key
              const row = map.get(k)
              if (row && row.user_id === user) {
                map.set(k, { ...row, deleted_at: deletedAt, updated_at: deletedAt, synced_at: nextSyncedAt() })
                updated++
              }
            }
            return json(res, 200, { updated })
          }
          if (path.startsWith('/files/')) {
            const filePath = decodeURIComponent(path.slice('/files/'.length))
            if (!filePath.startsWith(`${user}/`)) return json(res, 403, { error: 'row level security' })
            if (req.method === 'PUT') {
              files.set(filePath, { bytes: await readBody(req), type: req.headers['content-type'] || 'application/octet-stream' })
              return json(res, 200, { ok: true })
            }
            if (req.method === 'GET') {
              const f = files.get(filePath)
              if (!f) return json(res, 404, { error: 'not found' })
              res.statusCode = 200
              res.setHeader('content-type', f.type)
              return res.end(f.bytes)
            }
            if (req.method === 'DELETE') {
              files.delete(filePath)
              return json(res, 200, { ok: true })
            }
          }
          return json(res, 404, { error: 'unknown endpoint' })
        } catch (err) {
          return json(res, 500, { error: String(err?.message || err) })
        }
      })
    },
  }
}
