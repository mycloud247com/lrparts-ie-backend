export async function up(queryInterface) {
  await queryInterface.addColumn("orders", "vat_rate", {
    type: "DECIMAL(5,4)",
    allowNull: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn("orders", "vat_rate");
}
