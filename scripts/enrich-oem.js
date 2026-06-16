/**
 * Enrich products with OEM numbers from RIDEX v2 API.
 *
 * - Fetches all products that have no OEM numbers yet
 * - Calls RIDEX v2 API in batches to get referenceNumbers.OEM
 * - Inserts into oem_numbers table
 * - Updates search_vector to include OEM numbers
 *
 * Usage:
 *   node scripts/enrich-oem.js              # enrich all missing
 *   node scripts/enrich-oem.js --force      # re-enrich all (clears existing)
 *   node scripts/enrich-oem.js --dry-run    # preview without writing
 */
import "dotenv/config";
import DB from "../config/database.js";
import ridexService from "../src/services/ridex.js";

const BATCH_SIZE = 20;
const DELAY_MS = 2000;

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const db = new DB();
  await db.initiate();
  console.log("Database connected.\n");

  // Get products that need OEM enrichment
  let products;
  if (force) {
    products = await db.Product.findAll({
      where: { isActive: true },
      attributes: ["id", "articleNo"],
    });
    console.log(`Force mode: will process all ${products.length} products.\n`);
  } else {
    // Only products with zero OEM numbers
    const [rows] = await db.sequelize.query(`
      SELECT p.id, p.article_no
      FROM products p
      WHERE p.is_active = true
        AND NOT EXISTS (SELECT 1 FROM oem_numbers o WHERE o.product_id = p.id)
      ORDER BY p.article_no
    `);
    products = rows.map((r) => ({ id: r.id, articleNo: r.article_no }));
    console.log(`Found ${products.length} products without OEM numbers.\n`);
  }

  if (products.length === 0) {
    console.log("Nothing to do.");
    await db.close();
    return;
  }

  let totalOem = 0;
  let enriched = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const articleNos = batch.map((p) => p.articleNo);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);

    process.stdout.write(`Batch ${batchNum}/${totalBatches} (${articleNos.length} articles)... `);

    let v2Results = [];
    try {
      v2Results = await ridexService.getArticleInfo(articleNos);
    } catch (err) {
      console.log(`API error: ${err.message}`);
      failed += articleNos.length;
      await sleep(DELAY_MS);
      continue;
    }

    // Map articleNo -> OEM numbers
    const oemByArticle = {};
    for (const result of v2Results) {
      const articleNo = result.articleNo || result.ArticleNo;
      if (!articleNo) continue;
      const oems = result.referenceNumbers?.OEM || [];
      if (oems.length > 0) {
        oemByArticle[articleNo.toUpperCase()] = oems;
      }
    }

    // Build product ID map
    const productMap = {};
    for (const p of batch) {
      productMap[p.articleNo.toUpperCase()] = p.id;
    }

    let batchOemCount = 0;

    if (!dryRun) {
      // If force mode, clear existing OEMs for this batch
      if (force) {
        const productIds = batch.map((p) => p.id);
        await db.OemNumber.destroy({
          where: { productId: { [db.Sequelize.Op.in]: productIds } },
        });
      }

      // Insert new OEM numbers
      const records = [];
      for (const [articleNoUpper, oems] of Object.entries(oemByArticle)) {
        const productId = productMap[articleNoUpper];
        if (!productId) continue;
        for (const oem of oems) {
          const cleaned = oem.trim();
          if (!cleaned) continue;
          records.push({ productId, oemNumber: cleaned });
        }
      }

      if (records.length > 0) {
        await db.OemNumber.bulkCreate(records, { ignoreDuplicates: true });
        batchOemCount = records.length;
      }
    } else {
      for (const oems of Object.values(oemByArticle)) {
        batchOemCount += oems.length;
      }
    }

    enriched += Object.keys(oemByArticle).length;
    totalOem += batchOemCount;
    console.log(`${Object.keys(oemByArticle).length} products enriched, ${batchOemCount} OEM numbers`);

    if (i + BATCH_SIZE < products.length) {
      await sleep(DELAY_MS);
    }
  }

  // Update search_vector to include OEM numbers
  if (!dryRun && totalOem > 0) {
    console.log("\nUpdating search vectors with OEM numbers...");
    await db.sequelize.query(`
      UPDATE products p SET search_vector =
        setweight(to_tsvector('english', coalesce(p.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(p.article_no, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(p.ean, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(
          (SELECT string_agg(o.oem_number, ' ') FROM oem_numbers o WHERE o.product_id = p.id),
          ''
        )), 'A') ||
        setweight(to_tsvector('english', coalesce(p.ridex_category_slug, '')), 'C')
      WHERE p.is_active = true
    `);

    // Also update the trigger to include OEM numbers for future inserts
    await db.sequelize.query(`
      CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.article_no, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.ean, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(
            (SELECT string_agg(o.oem_number, ' ') FROM oem_numbers o WHERE o.product_id = NEW.id),
            ''
          )), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.ridex_category_slug, '')), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);
    console.log("Search vectors updated.");
  }

  console.log(`\nDone${dryRun ? " (dry run)" : ""}.`);
  console.log(`  Products enriched: ${enriched}`);
  console.log(`  OEM numbers added: ${totalOem}`);
  console.log(`  Failed: ${failed}`);

  await db.close();
}

run().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
