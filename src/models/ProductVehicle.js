export default (sequelize, Sequelize) => {
  const ProductVehicle = sequelize.define("ProductVehicle", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    vehicleEngineId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
  }, { tableName: "product_vehicles" });

  ProductVehicle.associate = (models) => {
    ProductVehicle.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
    ProductVehicle.belongsTo(models.VehicleEngine, { foreignKey: "vehicleEngineId", as: "engine" });
  };

  return ProductVehicle;
};
