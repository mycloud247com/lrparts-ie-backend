/**
 * Fix products with "Unknown Part" name — these are P-suffix variants
 * whose names weren't captured during scraping. Set their name to
 * the base product's name + " (Premium)".
 */
export async function up(qi) {
  await qi.sequelize.query(`
    UPDATE products p
    SET name = (
      SELECT base.name || ' (Premium)'
      FROM products base
      WHERE base.article_no = REPLACE(p.article_no, 'P', '')
        AND base.article_no != p.article_no
      LIMIT 1
    ),
    updated_at = NOW()
    WHERE p.name = 'Unknown Part'
      AND p.article_no LIKE '%P'
      AND EXISTS (
        SELECT 1 FROM products base
        WHERE base.article_no = REPLACE(p.article_no, 'P', '')
          AND base.article_no != p.article_no
      )
  `);

  // Also update any kit_items referencing these
  await qi.sequelize.query(`
    UPDATE kit_items ki
    SET name = p.name
    FROM products p
    WHERE ki.article_no = p.article_no
      AND ki.name = 'Unknown Part'
  `);
}

export async function down() {
  // Cannot reliably revert — names were wrong before
}
