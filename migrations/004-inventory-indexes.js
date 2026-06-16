export async function up(qi) {
  await qi.addIndex("inventory_items", ["ridex_article_no"], {
    name: "idx_inventory_article",
    where: { is_active: true },
  });
  await qi.addIndex("inventory_items", ["oe_part_no"], {
    name: "idx_inventory_oem",
    where: { is_active: true },
  });
  await qi.addIndex("inventory_items", ["part_name"], {
    name: "idx_inventory_part_name",
    where: { is_active: true },
  });
}

export async function down(qi) {
  await qi.removeIndex("inventory_items", "idx_inventory_article");
  await qi.removeIndex("inventory_items", "idx_inventory_oem");
  await qi.removeIndex("inventory_items", "idx_inventory_part_name");
}
