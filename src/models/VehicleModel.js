export default (sequelize, Sequelize) => {
  const VehicleModel = sequelize.define("VehicleModel", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    ridexId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    yearFrom: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    yearTo: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
  }, { tableName: "vehicle_models" });

  VehicleModel.associate = (models) => {
    VehicleModel.hasMany(models.VehicleEngine, { foreignKey: "vehicleModelId", as: "engines" });
    VehicleModel.hasMany(models.UserVehicle, { foreignKey: "vehicleModelId", as: "userVehicles" });
  };

  return VehicleModel;
};
