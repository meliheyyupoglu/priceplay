const term = process.argv[2] || 'Counter-Strike 2'
const url = `https://store.steampowered.com/search/?term=${encodeURIComponent(term)}&l=english&cc=us`

function firstN(arr, n) {
  return arr.slice(0, n)
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pickBestSteamSearchMatch(wantTitle, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const want = normText(wantTitle)

  const scored = candidates
    .filter((c) => c && typeof c === 'object' && c.appId && c.title)
    .map((c) => {
      const t = normText(c.title)
      let score = 0
      if (t === want) score += 1000
      if (t.includes(want)) score += 400
      if (want.includes(t)) score += 250
      const words = want.split(' ').filter((w) => w.length > 2)
      for (const w of words) {
        if (t.includes(w)) score += 30
      }
      return { raw: c, score, t }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.raw ?? null
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

;(async () => {
  const r = await fetch(url, { headers: { Accept: 'text/html' } })
  console.log('status', r.status)
  const html = await r.text()
  const termLower = String(term || '').toLowerCase().trim()
  const ix = termLower ? html.toLowerCase().indexOf(termLower) : -1
  console.log('htmlHasTerm', { term: termLower, has: ix >= 0 })
  if (ix >= 0) console.log('snippetAroundTerm:', html.slice(Math.max(0, ix - 250), ix + 250))

  // Steam arama sonucu satırlarında app id genelde data-ds-appid olarak geçiyor.
  // Sonuç satırında app id ile birlikte "title" span'ı genelde aynı block içinde.
  // Not: regex geniş aralık üzerinden çalıştığı için sadece seçim testinde kullanılacak.
  const rowRe =
    /data-ds-appid\s*=\s*"(\d+)"[\s\S]{0,4000}?<span[^>]*class\s*=\s*"title"[^>]*>([^<]*)<\/span>/g
  const matchesAny = [...html.matchAll(/data-ds-appid\s*=\s*\"(\d+)\"/g)]
  if (matchesAny[0]) {
    const idx = matchesAny[0].index ?? 0
    console.log('snippetAroundFirstAppId:', html.slice(Math.max(0, idx - 200), idx + 900))
  } else {
    console.log('no appid matches?')
  }

  const pairs = []
  for (const m of html.matchAll(rowRe)) {
    const appId = m[1]
    const rawTitle = decodeHtmlEntities(String(m[2] ? m[2] : '').trim())
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!rawTitle) continue
    pairs.push({ appId, title: rawTitle })
  }

  console.log('pairs', pairs.length)
  console.log('first', firstN(pairs, 10))
  const wantNorm = normText(term)
  const exact = pairs.filter((p) => normText(p.title) === wantNorm)
  const include = pairs.filter((p) => normText(p.title).includes(wantNorm))
  console.log('exactNormMatches', exact)
  console.log('includeNormMatchesCount', include.length)
  const want = term
  const best = pickBestSteamSearchMatch(want, pairs)
  console.log('bestForWant', { want, best })
})().catch((e) => {
  console.error(e)
  process.exit(1)
})

