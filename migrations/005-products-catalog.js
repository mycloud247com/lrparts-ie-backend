/**
 * Products catalog — adds products, product_images, product_specs, oem_numbers,
 * product_vehicles (fitment), and scrape_progress tables.
 */
export async function up(qi, Sequelize) {
  // ─── 1. products ──────────────────────────────────────────────
  await qi.createTable("products", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    article_no: { type: Sequelize.STRING, allowNull: false, unique: true },
    article_id: { type: Sequelize.STRING, allowNull: true },
    name: { type: Sequelize.STRING, allowNull: false },
    brand: { type: Sequelize.STRING, allowNull: true, defaultValue: "RIDEX" },
    ridex_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    ridex_quantity: { type: Sequelize.INTEGER, allowNull: true },
    category_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "categories", key: "id" },
      onDelete: "SET NULL",
    },
    ridex_category_slug: { type: Sequelize.STRING, allowNull: true },
    ridex_url: { type: Sequelize.STRING, allowNull: true },
    ean: { type: Sequelize.STRING, allowNull: true },
    is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
    last_synced_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("products", ["category_id"]);
  await qi.addIndex("products", ["brand"]);
  await qi.addIndex("products", ["ridex_category_slug"]);

  // ─── 2. product_images ────────────────────────────────────────
  await qi.createTable("product_images", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    product_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
      onDelete: "CASCADE",
    },
    url: { type: Sequelize.STRING, allowNull: false },
    sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
    is_primary: { type: Sequelize.BOOLEAN, defaultValue: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("product_images", ["product_id"]);

  // ─── 3. product_specs ─────────────────────────────────────────
  await qi.createTable("product_specs", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    product_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
      onDelete: "CASCADE",
    },
    spec_key: { type: Sequelize.STRING, allowNull: false },
    spec_value: { type: Sequelize.STRING, allowNull: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("product_specs", ["product_id", "spec_key"], { unique: true });

  // ─── 4. oem_numbers ───────────────────────────────────────────
  await qi.createTable("oem_numbers", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    product_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
      onDelete: "CASCADE",
    },
    oem_number: { type: Sequelize.STRING, allowNull: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("oem_numbers", ["oem_number"]);
  await qi.addIndex("oem_numbers", ["product_id"]);

  // ─── 5. product_vehicles (fitment junction) ───────────────────
  await qi.createTable("product_vehicles", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    product_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "products", key: "id" },
      onDelete: "CASCADE",
    },
    vehicle_engine_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "vehicle_engines", key: "id" },
      onDelete: "CASCADE",
    },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("product_vehicles", ["product_id", "vehicle_engine_id"], { unique: true });
  await qi.addIndex("product_vehicles", ["vehicle_engine_id"]);

  // ─── 6. scrape_progress ───────────────────────────────────────
  await qi.createTable("scrape_progress", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    vehicle_engine_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "vehicle_engines", key: "id" },
      onDelete: "CASCADE",
    },
    phase: { type: Sequelize.ENUM("scrape", "enrich"), allowNull: false },
    status: { type: Sequelize.ENUM("pending", "in_progress", "completed", "failed"), defaultValue: "pending" },
    products_found: { type: Sequelize.INTEGER, defaultValue: 0 },
    error_message: { type: Sequelize.TEXT, allowNull: true },
    started_at: { type: Sequelize.DATE, allowNull: true },
    completed_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("scrape_progress", ["vehicle_engine_id", "phase"], { unique: true });
}

export async function down(qi) {
  await qi.dropTable("scrape_progress");
  await qi.dropTable("product_vehicles");
  await qi.dropTable("oem_numbers");
  await qi.dropTable("product_specs");
  await qi.dropTable("product_images");
  await qi.dropTable("products");
}
