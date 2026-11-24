// Downloads every Ashes Reborn / Ascendancy card from the ashes.live public API
// and saves it as JSON in data/. Optionally downloads card images to images/.
//
// Usage: node scripts/fetch-cards.mjs [--images]
// Needs Node 18+ (uses the built-in fetch). No npm packages required.

import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const API = "https://api.ashes.live/v2";
const IMAGE_URL = (stub) => `https://cdn.ashes.live/images/cards/${stub}.jpg`;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(ROOT, "data");
const IMG_DIR = path.join(ROOT, "images");
const WANT_IMAGES = process.argv.includes("--images");
const PAGE = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw new Error(`${url} failed: ${err.message}`);
      await sleep(1000 * i);
    }
  }
}

// Page through /v2/cards with the given extra query string.
async function fetchAllCards(extra = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const url = `${API}/cards?limit=${PAGE}&offset=${offset}&releases=all&sort=release${extra}`;
    const page = await getJson(url);
    out.push(...page.results);
    console.log(`  ${out.length} / ${page.count}`);
    if (!page.next || page.results.length === 0) break;
    offset += PAGE;
  }
  return out;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  console.log("Fetching releases…");
  const releases = await getJson(`${API}/releases`);

  console.log("Fetching cards (main listing)…");
  const main = await fetchAllCards();
  // Safety check: the full listing should be several hundred cards.
  if (main.length < 400) throw new Error(`Only ${main.length} cards in main listing — something's wrong`);

  // Conjurations are sometimes left out of the normal listing; fetch them explicitly.
  console.log("Fetching conjurations…");
  const conj = await fetchAllCards(
    "&types=conjurations&types=conjuration&types=conjured_alteration_spell"
  );

  const byStub = new Map();
  for (const c of [...main, ...conj]) byStub.set(c.stub, c);
  const cards = [...byStub.values()].sort((a, b) => a.name.localeCompare(b.name));

  // One combined file plus one file per release.
  await writeFile(path.join(DATA_DIR, "releases.json"), JSON.stringify(releases, null, 2));
  await writeFile(path.join(DATA_DIR, "cards.json"), JSON.stringify(cards, null, 2));

  const relDir = path.join(DATA_DIR, "by-release");
  await mkdir(relDir, { recursive: true });
  const groups = {};
  for (const c of cards) (groups[c.release?.stub ?? "unknown"] ??= []).push(c);
  for (const [stub, list] of Object.entries(groups)) {
    await writeFile(path.join(relDir, `${stub}.json`), JSON.stringify(list, null, 2));
  }

  const meta = {
    source: "https://ashes.live (fan-made deckbuilder for Ashes Reborn / Ascendancy)",
    fetched_at: new Date().toISOString(),
    card_count: cards.length,
    release_count: releases.length,
  };
  await writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`Saved ${cards.length} cards across ${Object.keys(groups).length} releases.`);

  if (WANT_IMAGES) {
    await mkdir(IMG_DIR, { recursive: true });
    let got = 0, skipped = 0;
    const failed = [];
    for (const c of cards) {
      const file = path.join(IMG_DIR, `${c.stub}.jpg`);
      if (await exists(file)) { skipped++; continue; }
      try {
        const res = await fetch(IMAGE_URL(c.stub));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        got++;
        await sleep(100); // be polite to the CDN
      } catch (err) {
        failed.push(`${c.stub}: ${err.message}`);
      }
    }
    console.log(`Images: ${got} new, ${skipped} already saved, ${failed.length} failed.`);
    if (failed.length) {
      await writeFile(path.join(DATA_DIR, "missing-images.txt"), failed.join("\n") + "\n");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
