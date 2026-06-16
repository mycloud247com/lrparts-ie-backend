/**
 * Test script — check pagination patterns and compatibility scraping
 * Usage: node scripts/test-scrape.js
 */
import "dotenv/config";
import ridexScraper from "../src/services/ridexScraper.js";

async function test() {
  // Test 1: Check pagination
  console.log("=== Test 1: Pagination check ===\n");
  const url1 = "https://en.ridex.eu/catalog/filters/oil-filter";
  const url2 = "https://en.ridex.eu/catalog/filters/oil-filter?page=2";

  const html1 = await ridexScraper.fetchPage(url1);
  const products1 = ridexScraper.parseProducts(html1);
  console.log(`Page 1: ${products1.length} products`);
  console.log(`  First: ${products1[0]?.articleNo}`);
  console.log(`  Last: ${products1[products1.length - 1]?.articleNo}`);

  // Check for pagination links in HTML
  const pageLinks = html1.match(/[?&]page=(\d+)/g) || [];
  const pageNums = [...new Set(pageLinks.map(p => p.match(/\d+/)[0]))].sort((a, b) => a - b);
  console.log(`  Pagination links found: ${pageNums.join(", ") || "none"}`);

  // Check for total count
  const totalMatch = html1.match(/(\d+)\s*(?:results|items|products)/i);
  if (totalMatch) console.log(`  Total indicator: ${totalMatch[0]}`);

  const html2 = await ridexScraper.fetchPage(url2);
  const products2 = ridexScraper.parseProducts(html2);
  console.log(`\nPage 2: ${products2.length} products`);
  console.log(`  First: ${products2[0]?.articleNo}`);
  console.log(`  Last: ${products2[products2.length - 1]?.articleNo}`);

  const same = products1[0]?.articleNo === products2[0]?.articleNo;
  console.log(`\n  Same products? ${same ? "YES (pagination broken)" : "NO (pagination works!)"}`);

  // Test 2: Compatibility scraping
  console.log("\n\n=== Test 2: Compatibility check ===\n");
  const testArticleId = products1[0]?.articleId;
  if (testArticleId) {
    console.log(`Checking compatibility for articleId: ${testArticleId} (${products1[0]?.name})`);
    const vehicles = await ridexScraper.scrapeCompatibleVehicles(testArticleId);
    console.log(`\nCompatible makes: ${vehicles.length}`);
    for (const v of vehicles) {
      console.log(`  ${v.make}: ${v.models.length} models`);
      if (v.make === "LAND ROVER") {
        console.log(`    → LAND ROVER models: ${v.models.join(", ")}`);
      }
    }
  }

  // Test 3: Check a page with lots of products to see max pages
  console.log("\n\n=== Test 3: Last page check ===\n");
  const url10 = "https://en.ridex.eu/catalog/filters/oil-filter?page=10";
  const html10 = await ridexScraper.fetchPage(url10);
  const products10 = ridexScraper.parseProducts(html10);
  console.log(`Page 10: ${products10.length} products`);

  const url100 = "https://en.ridex.eu/catalog/filters/oil-filter?page=100";
  const html100 = await ridexScraper.fetchPage(url100);
  const products100 = ridexScraper.parseProducts(html100);
  console.log(`Page 100: ${products100.length} products`);
}

test().catch(console.error);
