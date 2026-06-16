export default (sequelize, Sequelize) => {
  const VehicleEngine = sequelize.define("VehicleEngine", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    vehicleModelId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    ridexId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    displacement: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    power: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    fuelType: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  }, { tableName: "vehicle_engines" });

  VehicleEngine.associate = (models) => {
    VehicleEngine.belongsTo(models.VehicleModel, { foreignKey: "vehicleModelId", as: "vehicleModel" });
  };

  return VehicleEngine;
};
