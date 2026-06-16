export default (sequelize, Sequelize) => {
  const MotorcheckMapping = sequelize.define("MotorcheckMapping", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    detailsPattern: { type: Sequelize.TEXT, allowNull: false },
    engineCc: { type: Sequelize.INTEGER, allowNull: true },
    fuel: { type: Sequelize.STRING, allowNull: true },
    yearFrom: { type: Sequelize.INTEGER, allowNull: true },
    yearTo: { type: Sequelize.INTEGER, allowNull: true },
    vehicleModelId: { type: Sequelize.UUID, allowNull: true },
    vehicleEngineId: { type: Sequelize.UUID, allowNull: true },
    confirmed: { type: Sequelize.BOOLEAN, defaultValue: false },
  }, { tableName: "motorcheck_mappings" });

  MotorcheckMapping.associate = (models) => {
    MotorcheckMapping.belongsTo(models.VehicleModel, { foreignKey: "vehicleModelId", as: "vehicleModel" });
    MotorcheckMapping.belongsTo(models.VehicleEngine, { foreignKey: "vehicleEngineId", as: "vehicleEngine" });
  };

  return MotorcheckMapping;
};
