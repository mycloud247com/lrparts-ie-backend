import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import DB from "./config/database.js";
import { slugify } from "./src/utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEMO_DIR = path.resolve(__dirname, "..", "demo", "data");

async function seed() {
  const db = new DB();
  await db.initiate();
  console.log("Database connected.");

  // ─── 1. Brands ───────────────────────────────────────────────
  console.log("\n[1/6] Seeding brands...");
  const brandNames = ["RIDEX", "Genuine", "Delphi", "Brembo", "Mahle", "Bosch"];
  await db.Brand.bulkCreate(
    brandNames.map((name) => ({ name, slug: slugify(name) })),
    { ignoreDuplicates: true }
  );
  console.log(`  -> ${brandNames.length} brands seeded.`);

  // ─── 2. Categories ──────────────────────────────────────────
  console.log("\n[2/6] Seeding categories...");
  const categoriesRaw = JSON.parse(
    fs.readFileSync(path.join(DEMO_DIR, "categories.json"), "utf-8")
  );

  // Filter out entries that are subcategories (contain "/") or have no name, or meta slugs
  const parentCategories = categoriesRaw.filter(
    (c) => c.name && !c.slug.includes("/") && c.slug !== "categoriesPopupLoad" && c.slug !== "new"
  );

  let sortOrder = 0;
  await db.Category.bulkCreate(
    parentCategories.map((c) => ({
      name: c.name,
      slug: c.slug,
      parentId: null,
      sortOrder: sortOrder++,
    })),
    { ignoreDuplicates: true }
  );
  console.log(`  -> ${parentCategories.length} parent categories seeded.`);

  // Fetch created parent categories to get their IDs
  const parentCatMap = {};
  const allParents = await db.Category.findAll({ where: { parentId: null } });
  for (const p of allParents) {
    parentCatMap[p.slug] = p.id;
  }

  // Subcategories mapping
  const subcategoryMap = {
    "brake-system": [
      { slug: "brake-pads", name: "Brake Pads" },
      { slug: "brake-discs", name: "Brake Discs" },
      { slug: "brake-calipers", name: "Brake Calipers" },
      { slug: "wear-sensors", name: "Wear Sensors" },
      { slug: "brake-fluid", name: "Brake Fluid" },
    ],
    filters: [
      { slug: "oil-filters", name: "Oil Filters" },
      { slug: "air-filters", name: "Air Filters" },
      { slug: "fuel-filters", name: "Fuel Filters" },
      { slug: "cabin-filters", name: "Cabin Filters" },
    ],
    engine: [
      { slug: "timing-belts", name: "Timing Belts" },
      { slug: "gaskets", name: "Gaskets" },
      { slug: "water-pumps", name: "Water Pumps" },
      { slug: "engine-mounts", name: "Engine Mounts" },
      { slug: "engine-sensors", name: "Engine Sensors" },
    ],
    suspension: [
      { slug: "bushes", name: "Bushes" },
      { slug: "shock-absorbers", name: "Shock Absorbers" },
      { slug: "springs", name: "Springs" },
      { slug: "air-suspension", name: "Air Suspension" },
      { slug: "control-arms", name: "Control Arms" },
    ],
    "cooling-system": [
      { slug: "radiators", name: "Radiators" },
      { slug: "thermostats", name: "Thermostats" },
      { slug: "coolant-hoses", name: "Coolant Hoses" },
      { slug: "cooling-fans", name: "Cooling Fans" },
    ],
    electrical: [
      { slug: "starters", name: "Starters" },
      { slug: "alternators", name: "Alternators" },
      { slug: "batteries", name: "Batteries" },
      { slug: "electrical-sensors", name: "Electrical Sensors" },
      { slug: "wiring", name: "Wiring" },
    ],
    exhaust: [
      { slug: "dpf", name: "DPF" },
      { slug: "catalytic-converters", name: "Catalytic Converters" },
      { slug: "exhaust-pipes", name: "Exhaust Pipes" },
      { slug: "exhaust-mounts", name: "Exhaust Mounts" },
    ],
    steering: [
      { slug: "steering-pumps", name: "Steering Pumps" },
      { slug: "steering-racks", name: "Steering Racks" },
      { slug: "tie-rods", name: "Tie Rods" },
    ],
  };

  const subRecords = [];
  for (const [parentSlug, subs] of Object.entries(subcategoryMap)) {
    const parentId = parentCatMap[parentSlug];
    if (!parentId) {
      console.warn(`  ⚠ Parent category "${parentSlug}" not found, skipping subcategories.`);
      continue;
    }
    for (const sub of subs) {
      subRecords.push({
        name: sub.name,
        slug: sub.slug,
        parentId,
        sortOrder: sortOrder++,
      });
    }
  }

  if (subRecords.length > 0) {
    await db.Category.bulkCreate(subRecords, { ignoreDuplicates: true });
  }
  console.log(`  -> ${subRecords.length} subcategories seeded.`);

  // ─── 3. Vehicle Models ──────────────────────────────────────
  console.log("\n[3/6] Seeding vehicle models...");
  const modelsRaw = JSON.parse(
    fs.readFileSync(path.join(DEMO_DIR, "models.json"), "utf-8")
  );

  const vehicleModelRecords = [];
  const slugSet = new Set();

  for (const [makeId, models] of Object.entries(modelsRaw)) {
    for (const model of models) {
      const parsed = parseModelName(model.name);
      // Ensure unique slug by appending ridexId if duplicate
      let slug = parsed.slug;
      if (slugSet.has(slug)) {
        slug = `${slug}-${model.id}`;
      }
      slugSet.add(slug);

      vehicleModelRecords.push({
        ridexId: String(model.id),
        name: parsed.name,
        slug,
        yearFrom: parsed.yearFrom,
        yearTo: parsed.yearTo,
      });
    }
  }

  if (vehicleModelRecords.length > 0) {
    await db.VehicleModel.bulkCreate(vehicleModelRecords, { ignoreDuplicates: true });
  }
  console.log(`  -> ${vehicleModelRecords.length} vehicle models seeded.`);

  // ─── 4. Vehicle Engines ─────────────────────────────────────
  console.log("\n[4/6] Seeding vehicle engines...");
  const enginesRaw = JSON.parse(
    fs.readFileSync(path.join(DEMO_DIR, "engines.json"), "utf-8")
  );

  // Build a lookup of ridexId -> db UUID for vehicle models
  const allModels = await db.VehicleModel.findAll({ attributes: ["id", "ridexId"] });
  const modelIdMap = {};
  for (const m of allModels) {
    modelIdMap[m.ridexId] = m.id;
  }

  const engineRecords = [];
  for (const [makeId, modelMap] of Object.entries(enginesRaw)) {
    for (const [modelRidexId, engines] of Object.entries(modelMap)) {
      const vehicleModelId = modelIdMap[modelRidexId];
      if (!vehicleModelId) {
        continue; // model not found, skip
      }
      for (const engine of engines) {
        const parsed = parseEngineName(engine.name);
        engineRecords.push({
          ridexId: String(engine.id),
          vehicleModelId,
          name: parsed.name,
          displacement: parsed.displacement,
          power: parsed.power,
          fuelType: parsed.fuelType,
        });
      }
    }
  }

  if (engineRecords.length > 0) {
    // Batch in chunks of 500 to avoid query size limits
    const CHUNK = 500;
    for (let i = 0; i < engineRecords.length; i += CHUNK) {
      await db.VehicleEngine.bulkCreate(engineRecords.slice(i, i + CHUNK), {
        ignoreDuplicates: true,
      });
    }
  }
  console.log(`  -> ${engineRecords.length} vehicle engines seeded.`);

  // ─── 5. Settings ────────────────────────────────────────────
  console.log("\n[5/6] Seeding settings...");
  const settings = [
    { key: "priceMultiplier", value: 1.3 },
    { key: "vatRate", value: 0.23 },
    { key: "freeShippingThreshold", value: 100 },
    { key: "shippingCost", value: 7.95 },
  ];
  await db.Setting.bulkCreate(settings, { ignoreDuplicates: true });
  console.log(`  -> ${settings.length} settings seeded.`);

  // ─── 6. Admin User ─────────────────────────────────────────
  console.log("\n[6/6] Seeding admin user...");
  const hashedPassword = await bcrypt.hash("Admin1234!", 12);
  await db.User.bulkCreate(
    [
      {
        firstName: "Admin",
        lastName: "User",
        email: "admin@lrparts.ie",
        password: hashedPassword,
        role: "admin",
        emailVerified: true,
        status: "active",
      },
    ],
    { ignoreDuplicates: true }
  );
  console.log("  -> Admin user seeded.");

  console.log("\nSeed complete.");
  await db.close();
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Parse a model name like:
 *   "Discovery III (L319) (07.2004 - 09.2009)"
 *   "Defender Off-Road (L663) (09.2019 - ...)"
 * Returns { name, slug, yearFrom, yearTo }
 */
function parseModelName(raw) {
  // Match the date range at the end: (MM.YYYY - MM.YYYY) or (MM.YYYY - ...)
  const dateMatch = raw.match(/\((\d{2})\.(\d{4})\s*-\s*(?:(\d{2})\.(\d{4})|\.\.\.)\)\s*$/);

  let yearFrom = null;
  let yearTo = null;
  let name = raw;

  if (dateMatch) {
    yearFrom = parseInt(dateMatch[2], 10);
    yearTo = dateMatch[4] ? parseInt(dateMatch[4], 10) : null;
    // Remove the date portion from the name
    name = raw.replace(/\s*\(\d{2}\.\d{4}\s*-\s*(?:\d{2}\.\d{4}|\.\.\.)\)\s*$/, "").trim();
  }

  const slug = slugify(name);

  return { name, slug, yearFrom, yearTo };
}

/**
 * Parse an engine name like:
 *   "2.7 TD 4x4, Year of Construction 07.2004 - 09.2009, 2720 ccm, 190 PS"
 *   "3.0 D 4x4, Year of Construction 09.2009 - 12.2018, 2993 ccm, 245 PS"
 * Returns { name, displacement, power, fuelType }
 */
function parseEngineName(raw) {
  // Extract displacement in ccm
  const ccmMatch = raw.match(/(\d+)\s*ccm/);
  const displacement = ccmMatch ? parseInt(ccmMatch[1], 10) : null;

  // Extract power in PS
  const psMatch = raw.match(/(\d+)\s*PS/);
  const power = psMatch ? parseInt(psMatch[1], 10) : null;

  // Extract fuel type heuristic from the engine designation
  const prefix = raw.split(",")[0].trim(); // e.g. "2.7 TD 4x4"
  let fuelType = null;
  if (/\bTD\b|\bTDI\b|\bTDV\b|\bCDI\b|\bD\b|\bSDV\b|\bHDI\b/.test(prefix)) {
    fuelType = "diesel";
  } else if (/\bTSI\b|\bTFSI\b|\bT\b/.test(prefix)) {
    fuelType = "petrol";
  } else if (/\bEV\b|\bElectric\b/i.test(prefix)) {
    fuelType = "electric";
  }

  // Use the prefix part before "Year of Construction" as the short name
  const name = prefix;

  return { name, displacement, power, fuelType };
}

// ─── Run ────────────────────────────────────────────────────────

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
