export default (sequelize, Sequelize) => {
  const InventoryItem = sequelize.define("InventoryItem", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    ridexArticleNo: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      comment: "RIDEX article number — primary identifier for matching",
    },
    oePartNo: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "OEM part number(s), can be multiple separated by / or ,",
    },
    partName: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Optional override — RIDEX provides name if blank",
    },
    customPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: "Our selling price (overrides RIDEX price × multiplier)",
    },
    customStock: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: "Our warehouse stock count",
    },
    imageUrl: {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Optional image URL override",
    },
    category: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    minQty: {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      comment: "Minimum stock alert threshold",
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
  }, { tableName: "inventory_items" });

  return InventoryItem;
};
