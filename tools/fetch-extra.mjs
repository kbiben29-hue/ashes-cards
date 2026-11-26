// Extra data for Argaia, downloaded from ashes.live:
//  • data/deck-popularity.json — how many public decks each Phoenixborn has (normal and Red Rains)
//  • data/precons.json         — every preconstructed deck with its card list
//  • images/<stub>.jpg         — Red Rains chimera cards (aspects, behaviour, ultimate, chimera, backs)
// Usage: node tools/fetch-extra.mjs

import { mkdir, writeFile, access } from 'node:fs/promises'

const API = 'https://api.ashes.live/v2'
const CDN = 'https://cdn.ashes.live/images/cards'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, tries = 4) {
	for (let i = 1; i <= tries; i++) {
		try {
			const res = await fetch(url, { headers: { Accept: 'application/json' } })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			return await res.json()
		} catch (err) {
			if (i === tries) throw new Error(`${url}: ${err.message}`)
			await sleep(1000 * i)
		}
	}
}

async function allDecks(extra) {
	const out = []
	for (let offset = 0; ; offset += 100) {
		const page = await getJson(`${API}/decks?limit=100&offset=${offset}${extra}`)
		if (offset === 0) console.log(`  ${page.count} decks (${extra || 'standard'})`)
		out.push(...page.results)
		if (!page.next || page.results.length === 0 || offset > 20000) break
		await sleep(150)
	}
	return out
}

const pbOf = (d) => (typeof d.phoenixborn === 'string' ? d.phoenixborn : d.phoenixborn?.stub ?? d.phoenixborn?.name ?? '?')

async function main() {
	await mkdir('data', { recursive: true })
	await mkdir('images', { recursive: true })

	console.log('Counting public decks…')
	const normal = await allDecks('')
	const rains = await allDecks('&show_red_rains=true')
	await writeFile('data/debug-deck-sample.json', JSON.stringify(normal.slice(0, 2), null, 2))
	const count = (list) => {
		const m = {}
		for (const d of list) m[pbOf(d)] = (m[pbOf(d)] ?? 0) + 1
		return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]))
	}
	await writeFile('data/deck-popularity.json', JSON.stringify({ fetched_at: new Date().toISOString(), decks: normal.length, red_rains_decks: rains.length, by_phoenixborn: count(normal), red_rains_by_phoenixborn: count(rains) }, null, 2))

	console.log('Preconstructed decks…')
	const precons = await allDecks('&show_preconstructed=true')
	const full = []
	for (const d of precons) {
		const id = d.id ?? d.source_id
		try {
			full.push(await getJson(`${API}/decks/${id}`))
		} catch (e) {
			console.log(`  skip ${id}: ${e.message}`)
		}
		await sleep(100)
	}
	await writeFile('data/precons.json', JSON.stringify(full, null, 2))
	console.log(`  ${full.length} precons`)

	console.log('Red Rains chimera images…')
	const stubs = [
		'corpse-of-viros',
		...[1, 2, 3].flatMap((n) => [`corpse-of-viros-1p-standard-${n}`, `corpse-of-viros-2p-standard-${n}`, `corpse-of-viros-1p-heroic-${n}`, `corpse-of-viros-behavior-${n}`, `corpse-of-viros-ultimate-${n}`]),
		'rampage', 'hunting-instincts', 'firebelly', 'constrict', 'stormcall', 'iron-scales', 'frozen-fear', 'whiplash', 'lurk', 'glare', 'dark-descent', 'regenerate',
		'back-blood-1', 'back-blood-2', 'back', 'back-conjuration',
	]
	const missing = []
	for (const s of stubs) {
		const file = `images/${s}.jpg`
		try {
			await access(file)
			continue
		} catch {}
		const res = await fetch(`${CDN}/${s}.jpg`)
		if (!res.ok) {
			missing.push(`${s}: ${res.status}`)
			continue
		}
		await writeFile(file, Buffer.from(await res.arrayBuffer()))
		await sleep(80)
	}
	await writeFile('data/missing-extra-images.txt', missing.join('\n') + '\n')
	console.log(`  missing: ${missing.length}`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
