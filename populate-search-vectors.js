import "dotenv/config";
import DB from "./config/database.js";

async function populateSearchVectors() {
  const db = new DB();
  await db.initiate();

  console.log("Populating search vectors for all products...");

  // Update search_vector for all products in one query
  const [result] = await db.sequelize.query(`
    UPDATE products
    SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(article_no, ''))
    WHERE is_active = true AND search_vector IS NULL
  `);

  console.log(`✓ Updated ${result.affectedRows || 'all'} products with search vectors.`);

  // Verify
  const [count] = await db.sequelize.query(`
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN search_vector IS NOT NULL THEN 1 END) as with_vector
    FROM products
  `);

  console.log(`\nProducts in database: ${count[0].total}`);
  console.log(`Products with search vector: ${count[0].with_vector}`);

  await db.close();
}

populateSearchVectors().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
