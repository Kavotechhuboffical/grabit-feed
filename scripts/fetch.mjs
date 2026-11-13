// Fetches football highlights from ScoreBat and writes highlights.json.
// The API token lives only in the SCOREBAT_TOKEN secret and is never written out.
import { readFile, writeFile } from "node:fs/promises";

const token = process.env.SCOREBAT_TOKEN;
if (!token) {
  console.error("Missing SCOREBAT_TOKEN secret");
  process.exit(1);
}

const candidates = [
  process.env.SCOREBAT_URL,
  "https://www.scorebat.com/video-api/v3/feed/",
  "https://www.scorebat.com/video-api/v3/",
].filter(Boolean);

const KEEP_DAYS = 14;
const MAX_ITEMS = 150;

async function tryFetch(base) {
  const url = `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    console.log(`${base} -> HTTP ${res.status}: ${text.slice(0, 200).replaceAll(token, "***")}`);
    return null;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log(`${base} -> not JSON: ${text.slice(0, 200).replaceAll(token, "***")}`);
    return null;
  }
  const list = Array.isArray(json) ? json : json.response ?? json.items ?? json.data;
  if (!Array.isArray(list)) {
    console.log(`${base} -> unexpected shape, keys: ${Object.keys(json).join(", ")}`);
    return null;
  }
  return list;
}

let raw = null;
for (const base of candidates) {
  raw = await tryFetch(base);
  if (raw) break;
}
if (!raw) {
  console.error("Could not read highlights from ScoreBat (see lines above).");
  process.exit(1);
}

const s = (v) => (v == null ? "" : String(v));

function normalize(m) {
  const comp = m.competition;
  const videos = (Array.isArray(m.videos) ? m.videos : [])
    .map((v) => ({ title: s(v.title), embed: s(v.embed) }))
    .filter((v) => v.embed);
  if (!videos.length) return null;
  const url = s(m.matchviewUrl || m.url);
  return {
    id: url || `${s(m.title)}|${s(m.date)}`,
    title: s(m.title),
    competition: typeof comp === "object" && comp ? s(comp.name) : s(comp),
    thumbnail: s(m.thumbnail),
    url,
    date: s(m.date),
    videos,
  };
}

let previous = [];
try {
  previous = JSON.parse(await readFile("highlights.json", "utf8")).items ?? [];
} catch {}

const byId = new Map();
for (const item of previous) byId.set(item.id, item);
for (const m of raw) {
  const item = normalize(m);
  if (item) byId.set(item.id, item);
}

const cutoff = Date.now() - KEEP_DAYS * 86400000;
const items = [...byId.values()]
  .filter((i) => {
    const t = Date.parse(i.date);
    return Number.isNaN(t) || t >= cutoff;
  })
  .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
  .slice(0, MAX_ITEMS);

const out = { updated: new Date().toISOString(), count: items.length, items };
const text = JSON.stringify(out, null, 1);
if (text.includes(token)) {
  console.error("Refusing to write: output contains the API token.");
  process.exit(1);
}
await writeFile("highlights.json", text + "\n");
console.log(`Wrote ${items.length} matches`);
