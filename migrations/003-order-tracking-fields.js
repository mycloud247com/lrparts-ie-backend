export async function up(qi, Sequelize) {
  await qi.addColumn("orders", "tracking_number", { type: Sequelize.STRING(100), allowNull: true });
  await qi.addColumn("orders", "tracking_url", { type: Sequelize.TEXT, allowNull: true });
  await qi.addColumn("orders", "carrier", { type: Sequelize.STRING(50), allowNull: true });
}

export async function down(qi) {
  await qi.removeColumn("orders", "tracking_number");
  await qi.removeColumn("orders", "tracking_url");
  await qi.removeColumn("orders", "carrier");
}
