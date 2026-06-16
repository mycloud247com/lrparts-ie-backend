export default (sequelize, Sequelize) => {
  const KitItem = sequelize.define("KitItem", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    kitId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    articleNo: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    sortOrder: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
  }, { tableName: "kit_items" });

  KitItem.associate = (models) => {
    KitItem.belongsTo(models.Kit, { foreignKey: "kitId", as: "kit" });
  };

  return KitItem;
};
