import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Sequelize } from "sequelize";
import bcrypt from "bcrypt";
import DB from "./config/database.js";
import { slugify } from "./src/utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const DATA_DIR = path.join(__dirname, "data");

// ─── STEP 1: MIGRATIONS ────────────────────────────────────────

async function runMigrations() {
  console.log("\n========== STEP 1: RUNNING MIGRATIONS ==========\n");

  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: "postgres",
      logging: false,
    }
  );

  // Ensure migrations table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const [executed] = await sequelize.query(`SELECT name FROM "_migrations" ORDER BY name`);
  const executedSet = new Set(executed.map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".js")).sort();
  const pending = files.filter((f) => !executedSet.has(f));

  if (pending.length === 0) {
    console.log("✓ No pending migrations.\n");
    await sequelize.close();
    return;
  }

  const qi = sequelize.getQueryInterface();

  for (const file of pending) {
    console.log(`Running: ${file}`);
    const migration = await import(new URL(`migrations/${file}`, import.meta.url));
    await migration.up(qi, Sequelize);
    await sequelize.query(`INSERT INTO "_migrations" (name) VALUES ($1)`, {
      bind: [file],
    });
    console.log(`  ✓ Done.`);
  }

  console.log(`\n✓ ${pending.length} migration(s) executed.\n`);
  await sequelize.close();
}

// ─── STEP 2: SEEDING ────────────────────────────────────────

async function seedData() {
  console.log("========== STEP 2: SEEDING DATA ==========\n");

  const db = new DB();
  await db.initiate();
  console.log("✓ Database connected.");

  // ─── 1. Brands ───────────────────────────────────────────────
  console.log("\n[1/6] Seeding brands...");
  const brandNames = ["RIDEX", "Genuine", "Delphi", "Brembo", "Mahle", "Bosch"];
  await db.Brand.bulkCreate(
    brandNames.map((name) => ({ name, slug: slugify(name) })),
    { ignoreDuplicates: true }
  );
  console.log(`  ✓ ${brandNames.length} brands seeded.`);

  // ─── 2. Categories ──────────────────────────────────────────
  console.log("\n[2/6] Seeding categories...");
  const categoriesRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "categories.json"), "utf-8")
  );

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
  console.log(`  ✓ ${parentCategories.length} parent categories seeded.`);

  const parentCatMap = {};
  const allParents = await db.Category.findAll({ where: { parentId: null } });
  for (const p of allParents) {
    parentCatMap[p.slug] = p.id;
  }

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
  console.log(`  ✓ ${subRecords.length} subcategories seeded.`);

  // ─── 3. Vehicle Models ──────────────────────────────────────
  console.log("\n[3/6] Seeding vehicle models...");
  const modelsRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "models.json"), "utf-8")
  );

  const vehicleModelRecords = [];
  const slugSet = new Set();

  for (const [makeId, models] of Object.entries(modelsRaw)) {
    for (const model of models) {
      const parsed = parseModelName(model.name);
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
  console.log(`  ✓ ${vehicleModelRecords.length} vehicle models seeded.`);

  // ─── 4. Vehicle Engines ─────────────────────────────────────
  console.log("\n[4/6] Seeding vehicle engines...");
  const enginesRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "engines.json"), "utf-8")
  );

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
        continue;
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
    const CHUNK = 500;
    for (let i = 0; i < engineRecords.length; i += CHUNK) {
      await db.VehicleEngine.bulkCreate(engineRecords.slice(i, i + CHUNK), {
        ignoreDuplicates: true,
      });
    }
  }
  console.log(`  ✓ ${engineRecords.length} vehicle engines seeded.`);

  // ─── 5. Kits ────────────────────────────────────────────────
  console.log("\n[5/6] Seeding kits...");
  const kits = [
    {
      name: "Discovery Service Kit",
      slug: "discovery-service-kit",
      description: "Complete service kit for Land Rover Discovery models. Includes oil filter, air filter, cabin filter, and spark plugs.",
      price: null,
      discountPercent: 5,
      isActive: true,
      sortOrder: 1,
      imageUrl: "https://images.unsplash.com/photo-1486262715619-3417ca6ef29f?w=500&h=500&fit=crop",
      items: [
        { articleNo: "OF-001", name: "Oil Filter", quantity: 1 },
        { articleNo: "AF-002", name: "Air Filter", quantity: 1 },
        { articleNo: "CF-003", name: "Cabin Filter", quantity: 1 },
        { articleNo: "SP-004", name: "Spark Plugs (Set of 6)", quantity: 1 },
      ],
    },
    {
      name: "Brake Maintenance Kit",
      slug: "brake-maintenance-kit",
      description: "Essential brake system maintenance kit with pads, discs, and brake fluid.",
      price: null,
      discountPercent: 8,
      isActive: true,
      sortOrder: 2,
      imageUrl: "https://images.unsplash.com/photo-1632823471565-2f2d0b8efff6?w=500&h=500&fit=crop",
      items: [
        { articleNo: "BP-001", name: "Brake Pads", quantity: 2 },
        { articleNo: "BD-002", name: "Brake Discs", quantity: 2 },
        { articleNo: "BF-003", name: "Brake Fluid (1L)", quantity: 1 },
      ],
    },
    {
      name: "Suspension Refresh Kit",
      slug: "suspension-refresh-kit",
      description: "Complete suspension overhaul kit including shock absorbers, springs, and bushings.",
      price: null,
      discountPercent: 10,
      isActive: true,
      sortOrder: 3,
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop",
      items: [
        { articleNo: "SA-001", name: "Shock Absorbers", quantity: 4 },
        { articleNo: "SP-002", name: "Coil Springs", quantity: 4 },
        { articleNo: "SB-003", name: "Suspension Bushings Kit", quantity: 1 },
      ],
    },
    {
      name: "Engine Performance Kit",
      slug: "engine-performance-kit",
      description: "Enhance engine performance with premium filters and ignition components.",
      price: null,
      discountPercent: 6,
      isActive: true,
      sortOrder: 4,
      imageUrl: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&h=500&fit=crop",
      items: [
        { articleNo: "AF-001", name: "High-Flow Air Filter", quantity: 1 },
        { articleNo: "OF-002", name: "Premium Oil Filter", quantity: 1 },
        { articleNo: "SP-003", name: "Performance Spark Plugs", quantity: 8 },
      ],
    },
    {
      name: "Cooling System Kit",
      slug: "cooling-system-kit",
      description: "Complete cooling system maintenance with radiator, thermostat, and coolant hoses.",
      price: null,
      discountPercent: 7,
      isActive: true,
      sortOrder: 5,
      imageUrl: "https://images.unsplash.com/photo-1531316282956-0a41b5b1d51d?w=500&h=500&fit=crop",
      items: [
        { articleNo: "CS-001", name: "Radiator", quantity: 1 },
        { articleNo: "TH-002", name: "Thermostat", quantity: 1 },
        { articleNo: "CH-003", name: "Coolant Hoses Kit", quantity: 1 },
        { articleNo: "CF-004", name: "Cooling Fans", quantity: 2 },
      ],
    },
    {
      name: "Electrical Starter Kit",
      slug: "electrical-starter-kit",
      description: "Essential electrical components for reliable starting and charging.",
      price: null,
      discountPercent: 5,
      isActive: true,
      sortOrder: 6,
      imageUrl: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=500&h=500&fit=crop",
      items: [
        { articleNo: "BA-001", name: "Premium Battery", quantity: 1 },
        { articleNo: "ST-002", name: "Starter Motor", quantity: 1 },
        { articleNo: "AL-003", name: "Alternator", quantity: 1 },
      ],
    },
    {
      name: "Transmission Fluid Kit",
      slug: "transmission-fluid-kit",
      description: "Complete transmission maintenance kit with filter and premium fluid.",
      price: null,
      discountPercent: 4,
      isActive: true,
      sortOrder: 7,
      imageUrl: "https://images.unsplash.com/photo-1539824904071-c4e9f84dd8f7?w=500&h=500&fit=crop",
      items: [
        { articleNo: "TF-001", name: "Transmission Filter", quantity: 1 },
        { articleNo: "TL-002", name: "Premium Transmission Fluid (5L)", quantity: 2 },
      ],
    },
    {
      name: "Exhaust System Kit",
      slug: "exhaust-system-kit",
      description: "Complete exhaust system with pipes, muffler, and catalytic converter.",
      price: null,
      discountPercent: 9,
      isActive: true,
      sortOrder: 8,
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop",
      items: [
        { articleNo: "EX-001", name: "Exhaust Pipes", quantity: 2 },
        { articleNo: "MU-002", name: "Muffler", quantity: 1 },
        { articleNo: "CC-003", name: "Catalytic Converter", quantity: 1 },
      ],
    },
    {
      name: "Steering Maintenance Kit",
      slug: "steering-maintenance-kit",
      description: "Steering system maintenance with pump, fluid, and seals.",
      price: null,
      discountPercent: 6,
      isActive: true,
      sortOrder: 9,
      imageUrl: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=500&h=500&fit=crop",
      items: [
        { articleNo: "SP-001", name: "Steering Pump", quantity: 1 },
        { articleNo: "SR-002", name: "Steering Rack", quantity: 1 },
        { articleNo: "SF-003", name: "Steering Fluid (2L)", quantity: 1 },
      ],
    },
    {
      name: "Complete Maintenance Kit",
      slug: "complete-maintenance-kit",
      description: "Ultimate maintenance kit covering all major vehicle systems.",
      price: 899.99,
      discountPercent: 15,
      isActive: true,
      sortOrder: 10,
      imageUrl: "https://images.unsplash.com/photo-1486262715619-3417ca6ef29f?w=500&h=500&fit=crop",
      items: [
        { articleNo: "OF-001", name: "Oil Filter", quantity: 1 },
        { articleNo: "AF-001", name: "Air Filter", quantity: 1 },
        { articleNo: "CF-001", name: "Cabin Filter", quantity: 1 },
        { articleNo: "BP-001", name: "Brake Pads", quantity: 2 },
        { articleNo: "SP-001", name: "Spark Plugs", quantity: 8 },
        { articleNo: "TF-001", name: "Transmission Filter", quantity: 1 },
      ],
    },
  ];

  for (const kitData of kits) {
    const { items, ...kitRecord } = kitData;
    const createdKit = await db.Kit.findOrCreate({
      where: { slug: kitRecord.slug },
      defaults: kitRecord,
    });

    if (items && items.length > 0) {
      const kitId = createdKit[0].id;
      const itemRecords = items.map((item, idx) => ({
        ...item,
        kitId,
        sortOrder: idx,
      }));
      await db.KitItem.bulkCreate(itemRecords, { ignoreDuplicates: true });
    }
  }
  console.log(`  ✓ ${kits.length} kits seeded.`);

  // ─── 6. Settings ────────────────────────────────────────────
  console.log("\n[6/6] Seeding settings...");
  const settings = [
    { key: "priceMultiplier", value: 1.3 },
    { key: "vatRate", value: 0.23 },
    { key: "freeShippingThreshold", value: 100 },
    { key: "shippingCost", value: 7.95 },
  ];
  await db.Setting.bulkCreate(settings, { ignoreDuplicates: true });
  console.log(`  ✓ ${settings.length} settings seeded.`);

  // ─── 7. Admin User ─────────────────────────────────────────
  console.log("\n[7/7] Seeding admin user...");
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
  console.log("  ✓ Admin user seeded.");

  console.log("\n✓ Seed complete.\n");
  await db.close();
}

// ─── STEP 3: POPULATE SEARCH VECTORS ────────────────────────────

async function populateSearchVectors() {
  console.log("========== STEP 3: POPULATING SEARCH VECTORS ==========\n");

  const db = new DB();
  await db.initiate();

  const [result] = await db.sequelize.query(`
    UPDATE products
    SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(article_no, ''))
    WHERE is_active = true AND search_vector IS NULL
  `);

  const [count] = await db.sequelize.query(`
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN search_vector IS NOT NULL THEN 1 END) as with_vector
    FROM products
  `);

  console.log(`Updated search vectors for products`);
  console.log(`✓ Total products: ${count[0].total}`);
  console.log(`✓ Products with search vectors: ${count[0].with_vector}\n`);

  await db.close();
}

// ─── HELPERS ────────────────────────────────────────────────────

function parseModelName(raw) {
  const dateMatch = raw.match(/\((\d{2})\.(\d{4})\s*-\s*(?:(\d{2})\.(\d{4})|\.\.\.)\)\s*$/);
  let yearFrom = null;
  let yearTo = null;
  let name = raw;

  if (dateMatch) {
    yearFrom = parseInt(dateMatch[2], 10);
    yearTo = dateMatch[4] ? parseInt(dateMatch[4], 10) : null;
    name = raw.replace(/\s*\(\d{2}\.\d{4}\s*-\s*(?:\d{2}\.\d{4}|\.\.\.)\)\s*$/, "").trim();
  }

  const slug = slugify(name);
  return { name, slug, yearFrom, yearTo };
}

function parseEngineName(raw) {
  const ccmMatch = raw.match(/(\d+)\s*ccm/);
  const displacement = ccmMatch ? parseInt(ccmMatch[1], 10) : null;

  const psMatch = raw.match(/(\d+)\s*PS/);
  const power = psMatch ? parseInt(psMatch[1], 10) : null;

  const prefix = raw.split(",")[0].trim();
  let fuelType = null;
  if (/\bTD\b|\bTDI\b|\bTDV\b|\bCDI\b|\bD\b|\bSDV\b|\bHDI\b/.test(prefix)) {
    fuelType = "diesel";
  } else if (/\bTSI\b|\bTFSI\b|\bT\b/.test(prefix)) {
    fuelType = "petrol";
  } else if (/\bEV\b|\bElectric\b/i.test(prefix)) {
    fuelType = "electric";
  }

  const name = prefix;
  return { name, displacement, power, fuelType };
}

// ─── MAIN EXECUTION ────────────────────────────────────────────

async function main() {
  try {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║  LR PARTS - COMPLETE DATABASE SETUP    ║");
    console.log("╚════════════════════════════════════════╝");

    await runMigrations();
    await seedData();
    await populateSearchVectors();

    console.log("╔════════════════════════════════════════╗");
    console.log("║  ✓ SETUP COMPLETE!                    ║");
    console.log("╚════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    process.exit(1);
  }
}

main();
