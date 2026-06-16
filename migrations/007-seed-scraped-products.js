/**
 * Seeds scraped product data from data/scrape/*.json into:
 *   products, product_images, product_specs, product_vehicles
 *
 * Relies on vehicle_engines already being seeded (via seed.js) with ridex_id values
 * that match the engine IDs in the scraped JSON files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPE_DIR = path.join(__dirname, "..", "data", "scrape");
const CHUNK = 500;

export async function up(qi, Sequelize) {
  const files = fs.readdirSync(SCRAPE_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("  No scraped files found, skipping.");
    return;
  }

  // ─── 1. Build engine ridexId → DB UUID lookup ─────────────────
  const [engineRows] = await qi.sequelize.query(
    `SELECT id, ridex_id FROM vehicle_engines WHERE ridex_id IS NOT NULL`
  );
  const engineMap = {};
  for (const row of engineRows) engineMap[row.ridex_id] = row.id;

  // ─── 2. Build category slug → DB UUID lookup ─────────────────
  const [catRows] = await qi.sequelize.query(`SELECT id, slug FROM categories`);
  const categoryMap = {};
  for (const row of catRows) categoryMap[row.slug] = row.id;

  // ─── 3. Parse all scraped files, dedupe products ──────────────
  const productMap = new Map(); // articleNo -> merged product data

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(SCRAPE_DIR, file), "utf-8"));
    } catch {
      console.warn(`  Skipping invalid JSON: ${file}`);
      continue;
    }

    for (const p of data.products || []) {
      if (!p.articleNo || !p.name) continue;

      if (productMap.has(p.articleNo)) {
        // Merge engine IDs from additional model files
        const existing = productMap.get(p.articleNo);
        for (const eid of p.engines || []) {
          if (!existing.engineIds.has(eid)) existing.engineIds.add(eid);
        }
      } else {
        productMap.set(p.articleNo, {
          articleNo: p.articleNo,
          articleId: p.articleId || null,
          name: p.name,
          image: p.image || null,
          price: p.price && p.price !== "0" ? p.price : null,
          qty: p.qty ? parseInt(p.qty) : null,
          category: p.category || null,
          specs: p.specs || {},
          engineIds: new Set(p.engines || []),
        });
      }
    }
  }

  console.log(`  Parsed ${productMap.size} unique products from ${files.length} files.`);

  // ─── 4. Resolve category slugs ────────────────────────────────
  // Scraped category format: "brake-system/brake-disc" or "filters/filter-interior-air"
  // We try to match the parent part (before /) to our categories table
  function resolveCategoryId(catSlug) {
    if (!catSlug) return null;
    // Try exact match first
    if (categoryMap[catSlug]) return categoryMap[catSlug];
    // Try parent slug (before /)
    const parent = catSlug.split("/")[0];
    if (categoryMap[parent]) return categoryMap[parent];
    return null;
  }

  // ─── 5. Insert products ───────────────────────────────────────
  const products = Array.from(productMap.values());
  const productRecords = products.map((p) => ({
    id: qi.sequelize.fn("gen_random_uuid"),
    article_no: p.articleNo,
    article_id: p.articleId,
    name: p.name,
    brand: "RIDEX",
    ridex_price: p.price ? parseFloat(p.price) : null,
    ridex_quantity: p.qty,
    category_id: resolveCategoryId(p.category),
    ridex_category_slug: p.category,
    ean: p.specs["EAN number"] || null,
    is_active: true,
    last_synced_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  }));

  for (let i = 0; i < productRecords.length; i += CHUNK) {
    await qi.bulkInsert("products", productRecords.slice(i, i + CHUNK));
  }
  console.log(`  Inserted ${productRecords.length} products.`);

  // ─── 6. Fetch inserted product IDs ────────────────────────────
  const [productRows] = await qi.sequelize.query(
    `SELECT id, article_no FROM products`
  );
  const productIdMap = {};
  for (const row of productRows) productIdMap[row.article_no] = row.id;

  // ─── 7. Insert product_images ─────────────────────────────────
  const imageRecords = [];
  for (const p of products) {
    const productId = productIdMap[p.articleNo];
    if (!productId) continue;

    const url = p.image || (p.articleId
      ? `https://cdn.ridex.de/thumb?m=4&n=0&id=${p.articleId}&lng=en&typ=custom&cc=1`
      : null);
    if (url) {
      imageRecords.push({
        id: qi.sequelize.fn("gen_random_uuid"),
        product_id: productId,
        url,
        sort_order: 0,
        is_primary: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  for (let i = 0; i < imageRecords.length; i += CHUNK) {
    await qi.bulkInsert("product_images", imageRecords.slice(i, i + CHUNK));
  }
  console.log(`  Inserted ${imageRecords.length} product images.`);

  // ─── 8. Insert product_specs ──────────────────────────────────
  const specRecords = [];
  for (const p of products) {
    const productId = productIdMap[p.articleNo];
    if (!productId || !p.specs) continue;

    for (const [key, value] of Object.entries(p.specs)) {
      if (key === "Manufacturer" || key === "Manufacturer part number" || key === "EAN number") continue;
      if (!value) continue;
      specRecords.push({
        id: qi.sequelize.fn("gen_random_uuid"),
        product_id: productId,
        spec_key: key,
        spec_value: String(value),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  for (let i = 0; i < specRecords.length; i += CHUNK) {
    await qi.bulkInsert("product_specs", specRecords.slice(i, i + CHUNK));
  }
  console.log(`  Inserted ${specRecords.length} product specs.`);

  // ─── 9. Insert product_vehicles (fitment) ─────────────────────
  const fitmentRecords = [];
  const fitmentSeen = new Set(); // avoid duplicates

  for (const p of products) {
    const productId = productIdMap[p.articleNo];
    if (!productId) continue;

    for (const engineRidexId of p.engineIds) {
      const engineDbId = engineMap[engineRidexId];
      if (!engineDbId) continue;

      const key = `${productId}_${engineDbId}`;
      if (fitmentSeen.has(key)) continue;
      fitmentSeen.add(key);

      fitmentRecords.push({
        id: qi.sequelize.fn("gen_random_uuid"),
        product_id: productId,
        vehicle_engine_id: engineDbId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  for (let i = 0; i < fitmentRecords.length; i += CHUNK) {
    await qi.bulkInsert("product_vehicles", fitmentRecords.slice(i, i + CHUNK));
  }
  console.log(`  Inserted ${fitmentRecords.length} fitment records.`);

  // ─── 10. Add full-text search index on products ───────────────
  await qi.sequelize.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;
  `);
  await qi.sequelize.query(`
    UPDATE products SET search_vector =
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(article_no, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(ean, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(ridex_category_slug, '')), 'C');
  `);
  await qi.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(search_vector);
  `);
  // Auto-update trigger
  await qi.sequelize.query(`
    CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.article_no, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.ean, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.ridex_category_slug, '')), 'C');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
  await qi.sequelize.query(`
    DROP TRIGGER IF EXISTS trg_products_search ON products;
    CREATE TRIGGER trg_products_search
      BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION products_search_trigger();
  `);
  console.log("  Added full-text search index.");
}

export async function down(qi) {
  await qi.sequelize.query(`DROP TRIGGER IF EXISTS trg_products_search ON products;`);
  await qi.sequelize.query(`DROP FUNCTION IF EXISTS products_search_trigger();`);
  await qi.sequelize.query(`DROP INDEX IF EXISTS idx_products_search;`);
  await qi.sequelize.query(`ALTER TABLE products DROP COLUMN IF EXISTS search_vector;`);
  await qi.bulkDelete("product_vehicles", null, {});
  await qi.bulkDelete("product_specs", null, {});
  await qi.bulkDelete("product_images", null, {});
  await qi.bulkDelete("products", null, {});
}
