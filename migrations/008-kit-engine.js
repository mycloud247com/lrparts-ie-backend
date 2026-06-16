/**
 * Add vehicle_engine_id to kits table — kits are specific to an engine variant.
 */
export async function up(qi, Sequelize) {
  await qi.addColumn("kits", "vehicle_engine_id", {
    type: Sequelize.UUID,
    allowNull: true,
    references: { model: "vehicle_engines", key: "id" },
    onDelete: "SET NULL",
  });
  await qi.addIndex("kits", ["vehicle_engine_id"]);
}

export async function down(qi) {
  await qi.removeColumn("kits", "vehicle_engine_id");
}
