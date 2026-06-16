/**
 * Create motorcheck_mappings table for caching VIN/reg lookup matches.
 */
export async function up(qi, Sequelize) {
  await qi.createTable("motorcheck_mappings", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    details_pattern: { type: Sequelize.TEXT, allowNull: false },
    engine_cc: { type: Sequelize.INTEGER, allowNull: true },
    fuel: { type: Sequelize.STRING, allowNull: true },
    year_from: { type: Sequelize.INTEGER, allowNull: true },
    year_to: { type: Sequelize.INTEGER, allowNull: true },
    vehicle_model_id: {
      type: Sequelize.UUID, allowNull: true,
      references: { model: "vehicle_models", key: "id" }, onDelete: "SET NULL",
    },
    vehicle_engine_id: {
      type: Sequelize.UUID, allowNull: true,
      references: { model: "vehicle_engines", key: "id" }, onDelete: "SET NULL",
    },
    confirmed: { type: Sequelize.BOOLEAN, defaultValue: false },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });

  await qi.addIndex("motorcheck_mappings", ["details_pattern", "engine_cc", "fuel"], { unique: true });
  await qi.addIndex("motorcheck_mappings", ["vehicle_model_id"]);
}

export async function down(qi) {
  await qi.dropTable("motorcheck_mappings");
}
