export default (sequelize, Sequelize) => {
  const Order = sequelize.define("Order", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    orderNumber: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: Sequelize.ENUM("pending", "confirmed", "processing", "shipped", "delivered", "cancelled"),
      defaultValue: "pending",
    },
    subtotal: {
      type: Sequelize.DECIMAL(10, 2),
    },
    shipping: {
      type: Sequelize.DECIMAL(10, 2),
    },
    vat: {
      type: Sequelize.DECIMAL(10, 2),
    },
    total: {
      type: Sequelize.DECIMAL(10, 2),
    },
    shippingAddressId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    stripeSessionId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    stripePaymentIntentId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    trackingNumber: {
      type: Sequelize.STRING(100),
      allowNull: true,
    },
    trackingUrl: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    carrier: {
      type: Sequelize.STRING(50),
      allowNull: true,
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    vatRate: {
      type: Sequelize.DECIMAL(5, 4),
      allowNull: true,
    },
  }, { tableName: "orders" });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Order.belongsTo(models.UserAddress, { foreignKey: "shippingAddressId", as: "shippingAddress" });
    Order.hasMany(models.OrderItem, { foreignKey: "orderId", as: "items" });
    Order.hasMany(models.OrderStatusLog, { foreignKey: "orderId", as: "statusLogs" });
  };

  return Order;
};
