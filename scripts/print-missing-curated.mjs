import fs from 'node:fs'

const db = JSON.parse(fs.readFileSync('data/cheapshark-db.json', 'utf8'))
const txt = fs.readFileSync('scripts/generate-demo-snapshot.mjs', 'utf8')

const m = txt.match(/const CURATED_POPULAR_TITLES = \[([\s\S]*?)\]\n\nconst SEARCH_TERMS/m)
if (!m) throw new Error('CURATED_POPULAR_TITLES not found')
const block = m[1]

const titles = []
for (const mm of block.matchAll(/'([^']*)'|"([^"]*)"/g)) {
  const v = mm[1] ? mm[1] : mm[2]
  if (v) titles.push(v)
}

const present = new Set(db.curatedPopular ? Object.keys(db.curatedPopular) : [])
const missing = titles.filter((t) => !present.has(t))

console.log('curatedTotal', titles.length)
console.log('curatedPresent', present.size)
console.log('missingCount', missing.length)
console.log(missing)

