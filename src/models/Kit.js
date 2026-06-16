export default (sequelize, Sequelize) => {
  const Kit = sequelize.define("Kit", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
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
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: "Optional override — null means auto-calculate from items",
    },
    discountPercent: {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Discount % on auto-calculated price",
    },
    imageUrl: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    vehicleModelId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    vehicleEngineId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
  }, { tableName: "kits" });

  Kit.associate = (models) => {
    Kit.belongsTo(models.VehicleModel, { foreignKey: "vehicleModelId", as: "vehicleModel" });
    Kit.belongsTo(models.VehicleEngine, { foreignKey: "vehicleEngineId", as: "vehicleEngine" });
    Kit.hasMany(models.KitItem, { foreignKey: "kitId", as: "items" });
  };

  return Kit;
};
