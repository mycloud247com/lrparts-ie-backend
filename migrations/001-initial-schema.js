/**
 * Initial schema — creates all 15 tables.
 */
export async function up(qi, Sequelize) {
  // ─── 1. users ──────────────────────────────────────────────
  await qi.createTable("users", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    first_name: { type: Sequelize.STRING, allowNull: false },
    last_name: { type: Sequelize.STRING, allowNull: false },
    email: { type: Sequelize.STRING, allowNull: false, unique: true },
    password: { type: Sequelize.STRING, allowNull: true },
    phone: { type: Sequelize.STRING, allowNull: true },
    role: { type: Sequelize.ENUM("user", "admin"), defaultValue: "user" },
    status: { type: Sequelize.ENUM("active", "suspended"), defaultValue: "active" },
    email_verified: { type: Sequelize.BOOLEAN, defaultValue: false },
    google_id: { type: Sequelize.STRING, allowNull: true, unique: true },
    verification_token: { type: Sequelize.STRING, allowNull: true },
    reset_token: { type: Sequelize.STRING, allowNull: true },
    reset_token_expiry: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 2. user_addresses ────────────────────────────────────
  await qi.createTable("user_addresses", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
    label: { type: Sequelize.STRING, allowNull: true },
    first_name: { type: Sequelize.STRING, allowNull: false },
    last_name: { type: Sequelize.STRING, allowNull: false },
    address_line1: { type: Sequelize.STRING, allowNull: false },
    address_line2: { type: Sequelize.STRING, allowNull: true },
    city: { type: Sequelize.STRING, allowNull: false },
    county: { type: Sequelize.STRING, allowNull: true },
    eircode: { type: Sequelize.STRING, allowNull: true },
    phone: { type: Sequelize.STRING, allowNull: true },
    is_default: { type: Sequelize.BOOLEAN, defaultValue: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 3. vehicle_models ────────────────────────────────────
  await qi.createTable("vehicle_models", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    ridex_id: { type: Sequelize.STRING, allowNull: true },
    name: { type: Sequelize.STRING, allowNull: false },
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },
    year_from: { type: Sequelize.INTEGER, allowNull: true },
    year_to: { type: Sequelize.INTEGER, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 4. vehicle_engines ───────────────────────────────────
  await qi.createTable("vehicle_engines", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    vehicle_model_id: { type: Sequelize.UUID, allowNull: false, references: { model: "vehicle_models", key: "id" }, onDelete: "CASCADE" },
    ridex_id: { type: Sequelize.STRING, allowNull: true },
    name: { type: Sequelize.STRING, allowNull: false },
    displacement: { type: Sequelize.INTEGER, allowNull: true },
    power: { type: Sequelize.INTEGER, allowNull: true },
    fuel_type: { type: Sequelize.STRING, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 5. user_vehicles ────────────────────────────────────
  await qi.createTable("user_vehicles", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
    vehicle_model_id: { type: Sequelize.UUID, allowNull: false, references: { model: "vehicle_models", key: "id" }, onDelete: "CASCADE" },
    vehicle_engine_id: { type: Sequelize.UUID, allowNull: true, references: { model: "vehicle_engines", key: "id" }, onDelete: "SET NULL" },
    nickname: { type: Sequelize.STRING, allowNull: true },
    reg_number: { type: Sequelize.STRING, allowNull: true },
    is_default: { type: Sequelize.BOOLEAN, defaultValue: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 6. brands ────────────────────────────────────────────
  await qi.createTable("brands", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false, unique: true },
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 7. categories ───────────────────────────────────────
  await qi.createTable("categories", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    slug: { type: Sequelize.STRING, allowNull: false, unique: true },
    description: { type: Sequelize.TEXT, allowNull: true },
    parent_id: { type: Sequelize.UUID, allowNull: true, references: { model: "categories", key: "id" }, onDelete: "SET NULL" },
    sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 8. inventory_items ──────────────────────────────────
  await qi.createTable("inventory_items", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    ridex_article_no: { type: Sequelize.STRING, allowNull: false, unique: true },
    oe_part_no: { type: Sequelize.STRING, allowNull: true },
    part_name: { type: Sequelize.STRING, allowNull: true },
    custom_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    custom_stock: { type: Sequelize.INTEGER, defaultValue: 0 },
    image_url: { type: Sequelize.STRING, allowNull: true },
    category: { type: Sequelize.STRING, allowNull: true },
    min_qty: { type: Sequelize.INTEGER, defaultValue: 1 },
    notes: { type: Sequelize.TEXT, allowNull: true },
    is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
    priority: { type: Sequelize.INTEGER, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 9. carts ────────────────────────────────────────────
  await qi.createTable("carts", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    user_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
    session_id: { type: Sequelize.STRING, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 10. cart_items ──────────────────────────────────────
  await qi.createTable("cart_items", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    cart_id: { type: Sequelize.UUID, allowNull: false, references: { model: "carts", key: "id" }, onDelete: "CASCADE" },
    article_no: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    image: { type: Sequelize.STRING, allowNull: true },
    quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    unit_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    is_our_part: { type: Sequelize.BOOLEAN, defaultValue: false },
    delivery: { type: Sequelize.STRING, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 11. orders ──────────────────────────────────────────
  // Create ENUMs first
  await qi.sequelize.query(`CREATE TYPE "enum_orders_status" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');`).catch(() => {});

  await qi.createTable("orders", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    user_id: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
    order_number: { type: Sequelize.STRING, allowNull: false, unique: true },
    status: { type: "enum_orders_status", defaultValue: "pending" },
    subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    shipping: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    vat: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    total: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
    shipping_address_id: { type: Sequelize.UUID, allowNull: true, references: { model: "user_addresses", key: "id" }, onDelete: "SET NULL" },
    stripe_session_id: { type: Sequelize.STRING, allowNull: true },
    stripe_payment_intent_id: { type: Sequelize.STRING, allowNull: true },
    notes: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 12. order_items ─────────────────────────────────────
  await qi.sequelize.query(`CREATE TYPE "enum_order_items_source" AS ENUM ('warehouse', 'supplier');`).catch(() => {});

  await qi.createTable("order_items", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    order_id: { type: Sequelize.UUID, allowNull: false, references: { model: "orders", key: "id" }, onDelete: "CASCADE" },
    article_no: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    quantity: { type: Sequelize.INTEGER, allowNull: false },
    unit_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    line_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
    source: { type: "enum_order_items_source", defaultValue: "supplier" },
    is_our_part: { type: Sequelize.BOOLEAN, defaultValue: false },
    delivery: { type: Sequelize.STRING, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 13. order_status_logs ────────────────────────────────
  await qi.createTable("order_status_logs", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    order_id: { type: Sequelize.UUID, allowNull: false, references: { model: "orders", key: "id" }, onDelete: "CASCADE" },
    from_status: { type: Sequelize.STRING, allowNull: true },
    to_status: { type: Sequelize.STRING, allowNull: false },
    note: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 14. settings ────────────────────────────────────────
  await qi.createTable("settings", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    key: { type: Sequelize.STRING, allowNull: false, unique: true },
    value: { type: Sequelize.JSONB, allowNull: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  // ─── 15. sync_logs ───────────────────────────────────────
  await qi.sequelize.query(`CREATE TYPE "enum_sync_logs_status" AS ENUM ('running', 'completed', 'failed');`).catch(() => {});

  await qi.createTable("sync_logs", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    type: { type: Sequelize.STRING, allowNull: false },
    status: { type: "enum_sync_logs_status", defaultValue: "running" },
    items_processed: { type: Sequelize.INTEGER, defaultValue: 0 },
    errors: { type: Sequelize.JSONB, allowNull: true },
    started_at: { type: Sequelize.DATE, allowNull: true },
    completed_at: { type: Sequelize.DATE, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });
}

export async function down(qi) {
  // Drop in reverse dependency order
  const tables = [
    "sync_logs", "settings", "order_status_logs", "order_items", "orders",
    "cart_items", "carts", "inventory_items", "categories", "brands",
    "user_vehicles", "vehicle_engines", "vehicle_models", "user_addresses", "users",
  ];
  for (const table of tables) {
    await qi.dropTable(table, { cascade: true });
  }

  // Drop ENUMs
  for (const e of ["enum_orders_status", "enum_order_items_source", "enum_sync_logs_status", "enum_users_role", "enum_users_status"]) {
    await qi.sequelize.query(`DROP TYPE IF EXISTS "${e}";`).catch(() => {});
  }
}
