// SPDA Real Estate: pull Dubai off-plan projects from the BlackDrive Live API
// into static JSON for the /off-plan/ page.
//
// Usage:   node tools/offplan-sync.mjs            (project list only, ~12 requests)
//          node tools/offplan-sync.mjs --plans    (also fetch floor plans for new or updated projects)
//
// The API key is read from the BLACKDRIVE_API_KEY environment variable
// (a GitHub Actions secret). It is never written to any file.
// Plan allowance: 10,000 requests a month, 60 a minute.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const API = "https://api.blackdrive.net/v2";
const OUT = new URL("../data/offplan/", import.meta.url);
const KEY = process.env.BLACKDRIVE_API_KEY || "";
const WITH_PLANS = process.argv.includes("--plans");
const PLAN_LIMIT = Number(process.env.PLAN_LIMIT || 1000); // max floor-plan requests per run
let requests = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    requests++;
    const res = await fetch(API + path, { headers: KEY ? { "X-API-Key": KEY } : {} });
    if (res.status === 429 || res.status >= 500) {
      const body = await res.json().catch(() => ({}));
      if (body.requests_used && body.monthly_limit && body.requests_used >= body.monthly_limit) {
        throw new Error(`Monthly allowance used (${body.requests_used}/${body.monthly_limit})`);
      }
      await sleep(((body.retry_after_seconds || 5 * (attempt + 1)) + 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
    await sleep(1100); // stay under 60 a minute
    return res.json();
  }
  throw new Error(`${path} kept failing`);
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

function plan(p) {
  // BlackDrive returns up to four stages; keep them only when they add up to 100%.
  if (!p) return null;
  const parts = ["one", "two", "three", "four"].map((k) => num(p[k]) || 0);
  const total = parts.reduce((a, b) => a + b, 0);
  return Math.round(total) === 100 ? parts : null;
}

const area = (s) => (s ? s.replace(/\s*\(.*\)\s*$/, "").trim() : null);

function slim(p) {
  return {
    id: String(p.id),
    name: p.project_name,
    dev: p.developer,
    area: area(p.community),
    sub: area(p.subcommunity),
    price: num(p.price_from),
    ho: p.handover,
    beds: p.bedrooms ? [p.bedrooms.min, p.bedrooms.max] : null,
    size: [num(p.min_size), num(p.max_size)],
    types: p.property_types || [],
    plan: plan(p.payment_plan),
    img: (p.images || []).slice(0, 4), // the first images are the developer's exterior renders
    brochure: p.brochure || null,
    amenities: (p.amenities || []).slice(0, 12),
    nplans: p.floor_plan_count || 0,
    stage: p.stage,
    upd: p.updated_at,
  };
  // The developer's marketing description is left out on purpose (SPDA voice).
}

const safeId = (id) => id.replace(/[^A-Za-z0-9_-]/g, "_");

async function main() {
  const P = new URL("p/", OUT);
  await mkdir(P, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  const all = [];
  let page = 1, pages = 1, meta = null;
  do {
    const r = await get(`/projects?emirate=Dubai&sort=updated_desc&page=${page}&size=100`);
    meta = meta || { status: r.data_status, updated: r.last_updated_at };
    pages = r.total_pages;
    for (const p of r.data) all.push(slim(p));
  } while (++page <= pages);

  // List only projects still being sold, with a price and a handover date still ahead.
  const listed = all.filter((p) => p.price && p.ho && p.ho >= today && !["COMPLETED", "SOLD_OUT"].includes(p.stage));

  let fetched = 0;
  for (const p of listed) {
    const file = new URL(`${safeId(p.id)}.json`, P);
    let old = null;
    try { old = JSON.parse(await readFile(file)); } catch {}
    let units = old && old.upd === p.upd ? old.units : null;
    if (WITH_PLANS && !units && p.nplans && fetched < PLAN_LIMIT) {
      try {
        const r = await get(`/projects/${encodeURIComponent(p.id)}/floor-plans`);
        units = r.data.map((u) => ({
          layout: u.layout, beds: u.bedrooms, type: u.bedroom_type,
          sqft: num(u.area_sq_ft), price: num(u.price_aed), img: u.image_url,
        }));
      } catch (e) {
        console.warn(`Skipped floor plans for ${p.id}: ${e.message}`);
      }
      fetched++;
    }
    await writeFile(file, JSON.stringify({ ...p, units: units || null }));
  }

  const list = listed.map((p) => ({
    id: p.id, f: safeId(p.id), name: p.name, dev: p.dev, area: p.area, price: p.price, ho: p.ho,
    beds: p.beds, types: p.types, plan: p.plan, img: p.img[0] || null, upd: p.upd,
  }));
  await writeFile(new URL("list.json", OUT), JSON.stringify({
    source: "BlackDrive Live API",
    data_status: meta.status,
    source_updated: meta.updated,
    synced: new Date().toISOString(),
    count: list.length,
    projects: list,
  }));
  console.log(`Dubai projects: ${all.length}, listed: ${listed.length}, floor plans fetched: ${fetched}, requests used: ${requests}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
