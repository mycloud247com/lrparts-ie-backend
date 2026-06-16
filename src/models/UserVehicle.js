export default (sequelize, Sequelize) => {
  const UserVehicle = sequelize.define("UserVehicle", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    vehicleModelId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    vehicleEngineId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    nickname: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    regNumber: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isDefault: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  }, { tableName: "user_vehicles" });

  UserVehicle.associate = (models) => {
    UserVehicle.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserVehicle.belongsTo(models.VehicleModel, { foreignKey: "vehicleModelId", as: "vehicleModel" });
    UserVehicle.belongsTo(models.VehicleEngine, { foreignKey: "vehicleEngineId", as: "vehicleEngine" });
  };

  return UserVehicle;
};
