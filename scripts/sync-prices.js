/**
 * Periodic Price/Stock Sync
 *
 * Calls RIDEX API v1 to update ridex_price and ridex_quantity for all products.
 * Run daily via cron or manually: node scripts/sync-prices.js
 */

import "dotenv/config";
import DB from "../config/database.js";
import ridexService from "../src/services/ridex.js";

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 1000; // 1s

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = new DB();
  await db.initiate();
  console.log("✓ Database connected.\n");

  const products = await db.Product.findAll({
    where: { isActive: true },
    attributes: ["id", "articleNo"],
  });

  console.log(`Products to sync: ${products.length}`);
  console.log(`Batches: ${Math.ceil(products.length / BATCH_SIZE)} × ${BATCH_SIZE}\n`);

  let synced = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const articleNos = batch.map((p) => p.articleNo);

    try {
      const results = await ridexService.getArticles(articleNos);

      for (const result of results) {
        const product = batch.find((p) => p.articleNo === result.articleNo);
        if (!product) continue;

        await db.Product.update(
          {
            ridexPrice: result.price ? parseFloat(result.price) : null,
            ridexQuantity: result.quantity != null ? parseInt(result.quantity) : null,
            lastSyncedAt: new Date(),
          },
          { where: { id: product.id } }
        );
        synced++;
      }
    } catch (err) {
      console.warn(`  ⚠ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${err.message}`);
      failed += batch.length;
    }

    const progress = Math.round(((i + batch.length) / products.length) * 100);
    process.stdout.write(`\r  Synced: ${synced} | Failed: ${failed} | Progress: ${progress}%`);

    await sleep(DELAY_BETWEEN_BATCHES);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n─── Sync Complete ───`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Time: ${elapsed}s`);

  // Log to sync_logs table
  await db.SyncLog.create({
    type: "price_sync",
    status: failed === 0 ? "completed" : "completed",
    itemsProcessed: synced,
    errors: failed > 0 ? { failedCount: failed } : null,
    startedAt: new Date(startTime),
    completedAt: new Date(),
  });

  await db.close();
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err);
  process.exit(1);
});
