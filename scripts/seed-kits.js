/**
 * Seed sample service kits with real products from the database.
 *
 * Usage:
 *   node scripts/seed-kits.js          # seed kits (skips if kits already exist)
 *   node scripts/seed-kits.js --force  # clear existing kits and re-seed
 */
import "dotenv/config";
import DB from "../config/database.js";
import { slugify } from "../src/utils/helper.js";

const force = process.argv.includes("--force");

async function run() {
  const db = new DB();
  await db.initiate();

  // Check existing
  const existingCount = await db.Kit.count({ where: { isActive: true } });
  if (existingCount > 0 && !force) {
    console.log(`${existingCount} kits already exist. Use --force to re-seed.`);
    await db.close();
    return;
  }

  if (force) {
    await db.sequelize.query("DELETE FROM kit_items");
    await db.sequelize.query("DELETE FROM kits");
    console.log("Cleared existing kits.");
  }

  // Get models
  const modelMap = {};
  const models = await db.VehicleModel.findAll({ attributes: ["id", "ridexId", "name"] });
  for (const m of models) modelMap[m.ridexId] = m;

  // Get first engine for each model
  const getEngine = async (modelId) => {
    const engine = await db.VehicleEngine.findOne({ where: { vehicleModelId: modelId }, attributes: ["id"] });
    return engine?.id || null;
  };

  // Get distinct products by subcategory for a model
  const getProducts = async (modelDbId, categoryPrefix, limit = 4) => {
    const [rows] = await db.sequelize.query(`
      SELECT DISTINCT ON (p.ridex_category_slug) p.article_no, p.name
      FROM products p
      JOIN product_vehicles pv ON pv.product_id = p.id
      JOIN vehicle_engines ve ON ve.id = pv.vehicle_engine_id
      WHERE ve.vehicle_model_id = :modelId
        AND p.ridex_category_slug LIKE :cat
        AND p.is_active = true
        AND p.name NOT LIKE '%Unknown%'
        AND p.name NOT LIKE '%(Premium)%'
      ORDER BY p.ridex_category_slug, p.name
      LIMIT :limit
    `, { replacements: { modelId: modelDbId, cat: `${categoryPrefix}%`, limit } });
    return rows;
  };

  // Kit definitions
  const kitDefs = [
    {
      name: "Discovery 3 Full Service Kit",
      description: "Complete service kit including oil filter, air filter, fuel filter and cabin filter for Discovery III L319",
      modelRidex: "5160", discount: 10, category: "filters",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8059167&lng=en&typ=custom&cc=1",
    },
    {
      name: "Discovery 3 Brake Kit",
      description: "Front and rear brake components for Discovery III L319",
      modelRidex: "5160", discount: 15, category: "brake-system",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8039417&lng=en&typ=custom&cc=1",
    },
    {
      name: "Discovery 4 Service Kit",
      description: "Essential service parts for Discovery IV L319 — all filters included",
      modelRidex: "9015", discount: 10, category: "filters",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8059167&lng=en&typ=custom&cc=1",
    },
    {
      name: "Defender Service Kit",
      description: "Oil filter, fuel filter, and air filter for Defender L316",
      modelRidex: "4673", discount: 12, category: "filters",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8059167&lng=en&typ=custom&cc=1",
    },
    {
      name: "Freelander 2 Brake Kit",
      description: "Complete brake kit for Freelander 2 L359",
      modelRidex: "5603", discount: 10, category: "brake-system",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8039417&lng=en&typ=custom&cc=1",
    },
    {
      name: "Discovery Sport Filter Kit",
      description: "All essential filters for Discovery Sport L550 service",
      modelRidex: "13104", discount: 8, category: "filters",
      image: "https://cdn.ridex.de/thumb?m=4&n=0&id=8059167&lng=en&typ=custom&cc=1",
    },
  ];

  let created = 0;

  for (const def of kitDefs) {
    const model = modelMap[def.modelRidex];
    if (!model) { console.log(`SKIP: Model ${def.modelRidex} not found`); continue; }

    const engineId = await getEngine(model.id);
    const products = await getProducts(model.id, def.category);

    if (products.length === 0) { console.log(`SKIP: No products for ${def.name}`); continue; }

    const kit = await db.Kit.create({
      name: def.name,
      slug: slugify(def.name),
      description: def.description,
      discountPercent: def.discount,
      imageUrl: def.image,
      vehicleModelId: model.id,
      vehicleEngineId: engineId,
      isActive: true,
    });

    for (const [idx, prod] of products.entries()) {
      await db.KitItem.create({
        kitId: kit.id,
        articleNo: prod.article_no,
        name: prod.name,
        quantity: 1,
        sortOrder: idx,
      });
    }

    console.log(`Created: ${def.name} | ${products.length} items | ${def.discount}% off`);
    created++;
  }

  console.log(`\nDone. ${created} kits created.`);
  await db.close();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
