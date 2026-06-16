export default (sequelize, Sequelize) => {
  const OrderItem = sequelize.define("OrderItem", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    orderId: {
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
    },
    unitPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    lineTotal: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    source: {
      type: Sequelize.ENUM("warehouse", "supplier"),
      defaultValue: "supplier",
    },
    isOurPart: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    delivery: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    kitId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    kitName: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  }, { tableName: "order_items" });

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
    OrderItem.belongsTo(models.Kit, { foreignKey: "kitId", as: "kit" });
  };

  return OrderItem;
};
