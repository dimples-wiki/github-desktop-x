// Rewrites stale repository paths stored in the app's IndexedDB after a
// project directory move. Usage:
//   node scripts/fix-stale-repo-paths.ts /old/prefix /new/prefix
const { _electron } = require('/Users/yoko/github-desktop-x/workspace/node_modules/playwright')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const oldPrefix = process.argv[2]
const newPrefix = process.argv[3]

if (!oldPrefix || !newPrefix) {
  console.error('usage: fix-stale-repo-paths.ts <oldPrefix> <newPrefix>')
  process.exit(2)
}

;(async () => {
  const app = await _electron.launch({
    executablePath: APP,
    timeout: 60000,
  })
  const page = await app.firstWindow()
  await page.waitForFunction(() => !!document.body, null, { timeout: 30000 })
  await page.waitForTimeout(1500)

  const result = await page.evaluate(
    async ({ oldPrefix, newPrefix }) => {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('Database')
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      const updated = []
      await new Promise((res, rej) => {
        const tx = db.transaction('repositories', 'readwrite')
        const store = tx.objectStore('repositories')
        const rq = store.getAll()
        rq.onsuccess = async () => {
          for (const row of rq.result) {
            if (typeof row.path === 'string' && row.path.startsWith(oldPrefix)) {
              const next = newPrefix + row.path.slice(oldPrefix.length)
              await new Promise((res2, rej2) => {
                const rx = store.put({ ...row, path: next })
                rx.onsuccess = () => res2()
                rx.onerror = () => rej2(rx.error)
              })
              updated.push({ id: row.id, from: row.path, to: next })
            }
          }
          res()
        }
        rq.onerror = () => rej(rq.error)
      })
      db.close()
      return updated
    },
    { oldPrefix, newPrefix }
  )

  console.log('updated records:', JSON.stringify(result, null, 1))
  await app.close()
  process.exit(result.length > 0 ? 0 : 1)
})().catch(e => {
  console.error('FAIL', e.message)
  process.exit(1)
})
