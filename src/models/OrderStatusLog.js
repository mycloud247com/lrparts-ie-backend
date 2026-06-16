export default (sequelize, Sequelize) => {
  const OrderStatusLog = sequelize.define("OrderStatusLog", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    fromStatus: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    toStatus: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    note: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  }, { tableName: "order_status_logs" });

  OrderStatusLog.associate = (models) => {
    OrderStatusLog.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
  };

  return OrderStatusLog;
};
