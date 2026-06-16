/**
 * Full Land Rover RIDEX Scrape — AJAX-based, per-model JSON output
 *
 * Uses RIDEX's internal AJAX endpoint (POST /ajax/listing) which does
 * server-side vehicle filtering. Each model gets its own JSON file.
 *
 * Output: backend/data/scrape/<model-slug>.json
 *
 * Usage:
 *   node scripts/full-scrape.js                    # full run (all 40 models)
 *   node scripts/full-scrape.js --resume           # skip models that already have a JSON file
 *   node scripts/full-scrape.js --model=discovery-iii-l319  # single model
 *   node scripts/full-scrape.js --status           # show progress
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import DB from "../config/database.js";
import ridexScraper from "../src/services/ridexScraper.js";
import { SUBCATEGORY_IDS, ALL_SUBCATEGORY_SLUGS } from "./subcategory-ids.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "data", "scrape");

const LAND_ROVER_MAKER_ID = "1820";
const DELAY_BETWEEN_REQUESTS = 3000; // 3s — avoid RIDEX rate limiting
const DELAY_BETWEEN_ENGINES = 5000; // 5s between engines

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

// ─── Helpers ──────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === "--resume") args.resume = true;
    else if (arg === "--status") args.status = true;
    else if (arg.startsWith("--model=")) args.model = arg.split("=")[1];
  }
  return args;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// ─── AJAX Session ─────────────────────────────────────────────────
async function getSession() {
  const res = await axios.get("https://en.ridex.eu/catalog/filters/oil-filter", {
    headers: { "User-Agent": HEADERS["User-Agent"] },
    timeout: 15000,
  });

  const csrfMatch = res.data.match(/csrf-token" content="([^"]+)"/);
  if (!csrfMatch) throw new Error("Could not extract CSRF token");

  const cookies = (res.headers["set-cookie"] || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  return { csrf: csrfMatch[1], cookies };
}

// ─── AJAX Listing Call ────────────────────────────────────────────
async function fetchListing(session, subcategoryId, modelRidexId, modelName, carRidexId, carName, page = 1) {
  const url = `https://en.ridex.eu/ajax/listing?subcategoryId=${subcategoryId}${page > 1 ? `&page=${page}` : ""}`;

  const body = new URLSearchParams();
  body.append("_token", session.csrf);
  body.append("subcategoryId", subcategoryId);
  body.append("makerId", LAND_ROVER_MAKER_ID);
  body.append("makerName", "LAND ROVER");
  body.append("modelId", modelRidexId);
  body.append("modelName", modelName);
  body.append("carId", carRidexId);
  body.append("carName", carName);

  const res = await axios.post(url, body.toString(), {
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-TOKEN": session.csrf,
      Cookie: session.cookies,
    },
    timeout: 15000,
  });

  return res.data;
}

// ─── Parse AJAX response ─────────────────────────────────────────
function parseAjaxProducts(data) {
  if (!data.success || !data.products_html) return { products: [], maxPage: 1 };

  const products = ridexScraper.parseProducts(data.products_html);

  let maxPage = 1;
  if (data.pagination_html) {
    const pages = data.pagination_html.match(/page=(\d+)/g);
    if (pages) {
      maxPage = Math.max(...pages.map((p) => parseInt(p.match(/\d+/)[0])));
    }
  }

  return { products, maxPage };
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const db = new DB();
  await db.initiate();
  console.log("✓ Database connected.");

  ensureOutputDir();

  if (args.status) {
    showStatus(db);
    await db.close();
    return;
  }

  // Get models with engines
  let models;
  if (args.model) {
    models = await db.VehicleModel.findAll({
      where: { slug: args.model },
      include: [{ model: db.VehicleEngine, as: "engines" }],
    });
    if (models.length === 0) {
      console.error(`Model "${args.model}" not found.`);
      const all = await db.VehicleModel.findAll({ attributes: ["slug", "name"] });
      all.forEach((m) => console.log(`  - ${m.slug} (${m.name})`));
      await db.close();
      return;
    }
  } else {
    models = await db.VehicleModel.findAll({
      include: [{ model: db.VehicleEngine, as: "engines" }],
      order: [["name", "ASC"]],
    });
  }

  console.log(`Models to process: ${models.length}\n`);

  // Get session
  console.log("Getting RIDEX session...");
  let session = await getSession();
  console.log("✓ CSRF token acquired.\n");
  let requestCount = 0;

  let totalProducts = 0;
  let modelsCompleted = 0;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    const engines = model.engines || [];
    const outputFile = path.join(OUTPUT_DIR, `${model.slug}.json`);

    if (engines.length === 0) {
      console.log(`[${mi + 1}/${models.length}] ${model.name} — no engines, skipping`);
      continue;
    }

    // Resume: skip if file already exists
    if (args.resume && fs.existsSync(outputFile)) {
      console.log(`[${mi + 1}/${models.length}] ${model.name} — already scraped, skipping`);
      modelsCompleted++;
      continue;
    }

    console.log(`[${mi + 1}/${models.length}] ${model.name} (${engines.length} engines)`);

    // Per-model data structure
    const modelData = {
      model: {
        name: model.name,
        slug: model.slug,
        ridexId: model.ridexId,
        yearFrom: model.yearFrom,
        yearTo: model.yearTo,
      },
      engines: [],
      products: {}, // keyed by articleNo for dedup
      scrapedAt: new Date().toISOString(),
    };

    for (let ei = 0; ei < engines.length; ei++) {
      const engine = engines[ei];
      const engineRidexId = engine.ridexId;

      if (!model.ridexId || !engineRidexId) {
        console.log(`  [${ei + 1}/${engines.length}] ${engine.name} — no RIDEX ID, skipping`);
        continue;
      }

      const engineData = {
        name: engine.name,
        ridexId: engineRidexId,
        displacement: engine.displacement,
        power: engine.power,
        fuelType: engine.fuelType,
        productsFound: 0,
      };

      console.log(`  [${ei + 1}/${engines.length}] ${engine.name}`);

      let engineProductCount = 0;

      for (const slug of ALL_SUBCATEGORY_SLUGS) {
        const subcategoryId = SUBCATEGORY_IDS[slug];

        // Refresh session every 200 requests
        if (requestCount > 0 && requestCount % 200 === 0) {
          console.log("    ↻ Refreshing session...");
          session = await getSession();
        }

        await sleep(DELAY_BETWEEN_REQUESTS);
        requestCount++;

        let page = 1;
        let maxPage = 1;

        do {
          let data;
          try {
            data = await fetchListing(session, subcategoryId, model.ridexId, model.name, engineRidexId, engine.name, page);
          } catch (err) {
            if (err.response?.status === 419) {
              session = await getSession();
              data = await fetchListing(session, subcategoryId, model.ridexId, model.name, engineRidexId, engine.name, page);
            } else {
              console.warn(`    ⚠ ${slug} page ${page}: ${err.message}`);
              break;
            }
          }

          const { products, maxPage: mp } = parseAjaxProducts(data);
          maxPage = mp;

          if (products.length === 0) break;

          for (const p of products) {
            if (!p.articleNo) continue;

            if (!modelData.products[p.articleNo]) {
              // New product
              modelData.products[p.articleNo] = {
                articleNo: p.articleNo,
                articleId: p.articleId || null,
                name: p.name || "Unknown Part",
                image: p.image || null,
                price: p.price || null,
                qty: p.qty || null,
                category: slug,
                specs: p.specs || {},
                engines: [engineRidexId], // which engines it fits
              };
              engineProductCount++;
            } else {
              // Already exists — add this engine to fitment
              const existing = modelData.products[p.articleNo];
              if (!existing.engines.includes(engineRidexId)) {
                existing.engines.push(engineRidexId);
              }
            }
          }

          page++;
          if (page <= maxPage) await sleep(DELAY_BETWEEN_REQUESTS);
        } while (page <= maxPage);
      }

      engineData.productsFound = engineProductCount;
      modelData.engines.push(engineData);
      console.log(`    → ${engineProductCount} new products`);

      await sleep(DELAY_BETWEEN_ENGINES);
    }

    // Convert products map to array
    const productCount = Object.keys(modelData.products).length;
    modelData.products = Object.values(modelData.products);
    modelData.totalProducts = productCount;

    // Save to file
    fs.writeFileSync(outputFile, JSON.stringify(modelData, null, 2));
    console.log(`  ✓ Saved ${productCount} products → ${model.slug}.json\n`);

    totalProducts += productCount;
    modelsCompleted++;
  }

  console.log("═".repeat(60));
  console.log("SCRAPE COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Models completed: ${modelsCompleted}`);
  console.log(`  Total unique products: ${totalProducts}`);
  console.log(`  AJAX requests: ${requestCount}`);
  console.log(`  Output: ${OUTPUT_DIR}/`);

  await db.close();
}

// ─── Status ───────────────────────────────────────────────────────
function showStatus() {
  ensureOutputDir();
  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));

  let totalProducts = 0;
  console.log("═══ SCRAPE STATUS ═══\n");

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), "utf8"));
    console.log(`  ✓ ${data.model.name}: ${data.totalProducts} products, ${data.engines.length} engines`);
    totalProducts += data.totalProducts;
  }

  console.log(`\n  Files: ${files.length}`);
  console.log(`  Total products (with overlap): ${totalProducts}`);
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err);
  process.exit(1);
});
