/**
 * Kits — product bundles that admin creates, users buy in one click.
 */
export async function up(qi, Sequelize) {
  // ─── 1. kits ──────────────────────────────────────────────────
  await qi.createTable("kits", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },
    price: { type: Sequelize.DECIMAL(10, 2), allowNull: true, comment: "Optional override — null means auto-calculate from items" },
    discount_percent: { type: Sequelize.DECIMAL(5, 2), allowNull: true, defaultValue: 0, comment: "Optional discount on auto-calculated price" },
    image_url: { type: Sequelize.STRING, allowNull: true },
    vehicle_model_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "vehicle_models", key: "id" },
      onDelete: "SET NULL",
    },
    is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
    sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("kits", ["vehicle_model_id"]);
  await qi.addIndex("kits", ["is_active"]);

  // ─── 2. kit_items ─────────────────────────────────────────────
  await qi.createTable("kit_items", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    kit_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "kits", key: "id" },
      onDelete: "CASCADE",
    },
    article_no: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("kit_items", ["kit_id"]);

  // ─── 3. Add kit_id to cart_items ──────────────────────────────
  await qi.addColumn("cart_items", "kit_id", {
    type: Sequelize.UUID,
    allowNull: true,
    references: { model: "kits", key: "id" },
    onDelete: "SET NULL",
  });

  // ─── 4. Add kit fields to order_items ─────────────────────────
  await qi.addColumn("order_items", "kit_id", {
    type: Sequelize.UUID,
    allowNull: true,
    references: { model: "kits", key: "id" },
    onDelete: "SET NULL",
  });
  await qi.addColumn("order_items", "kit_name", {
    type: Sequelize.STRING,
    allowNull: true,
  });
}

export async function down(qi) {
  await qi.removeColumn("order_items", "kit_name");
  await qi.removeColumn("order_items", "kit_id");
  await qi.removeColumn("cart_items", "kit_id");
  await qi.dropTable("kit_items");
  await qi.dropTable("kits");
}
