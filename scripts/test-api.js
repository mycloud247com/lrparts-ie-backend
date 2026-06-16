/**
 * Test RIDEX API — check total product count and OEM filtering
 * Usage: node scripts/test-api.js
 */
import "dotenv/config";
import ridexService from "../src/services/ridex.js";

async function test() {
  await ridexService.ensureAuth();
  console.log("✓ Authenticated\n");

  // Test 1: Get total product count via GET /api/v1/articles
  console.log("=== Test 1: Get All Products (page 1) ===");
  const page1 = await ridexService.apiRequest("GET", "/api/v1/articles?page=1&limit=5");
  console.log("Response keys:", Object.keys(page1));
  console.log("Data count:", page1.data?.length);
  console.log("Meta/pagination:", JSON.stringify(page1.meta, null, 2));
  console.log("First product:", JSON.stringify(page1.data?.[0], null, 2));

  // Test 2: Get detailed info for first few products (check OEM numbers)
  console.log("\n=== Test 2: V2 Article Info ===");
  const articleNos = (page1.data || []).slice(0, 3).map(p => p.ArticleNo);
  console.log("Checking articles:", articleNos);
  const details = await ridexService.getArticleInfo(articleNos);
  for (const d of details) {
    console.log(`\n  ${d.articleNo} — ${d.productName}`);
    console.log(`    OEM: ${JSON.stringify(d.referenceNumbers?.OEM || [])}`);
    console.log(`    EAN: ${d.referenceNumbers?.EAN || "none"}`);
  }

  // Test 3: Check a known LR-compatible product (from our earlier scrape)
  console.log("\n=== Test 3: Known LR products ===");
  const lrArticles = ["9F0021", "9F0052"]; // fuel filters from earlier scrape
  const lrDetails = await ridexService.getArticleInfo(lrArticles);
  for (const d of lrDetails) {
    console.log(`\n  ${d.articleNo} — ${d.productName}`);
    console.log(`    OEM: ${JSON.stringify(d.referenceNumbers?.OEM || [])}`);
    const hasLrOem = (d.referenceNumbers?.OEM || []).some(oem =>
      /^(LR|RTC|STC|ERR|ERC|ANR|NTC|ESR|WFL|GFE|PHE|JKR|WJN|RFM|LPX)/i.test(oem)
    );
    console.log(`    Has LR OEM prefix: ${hasLrOem}`);
  }
}

test().catch(console.error);
