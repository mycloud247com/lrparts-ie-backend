/**
 * Extend URL/image columns from VARCHAR(255) to TEXT to support long URLs.
 */
export async function up(qi) {
  await qi.changeColumn("inventory_items", "image_url", { type: "TEXT" });
  await qi.changeColumn("product_images", "url", { type: "TEXT" });
  await qi.changeColumn("products", "ridex_url", { type: "TEXT" });
  await qi.changeColumn("kits", "image_url", { type: "TEXT" });
  await qi.changeColumn("cart_items", "image", { type: "TEXT" });
}

export async function down(qi, Sequelize) {
  await qi.changeColumn("inventory_items", "image_url", { type: Sequelize.STRING });
  await qi.changeColumn("product_images", "url", { type: Sequelize.STRING });
  await qi.changeColumn("products", "ridex_url", { type: Sequelize.STRING });
  await qi.changeColumn("kits", "image_url", { type: Sequelize.STRING });
  await qi.changeColumn("cart_items", "image", { type: Sequelize.STRING });
}
