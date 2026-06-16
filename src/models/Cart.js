export default (sequelize, Sequelize) => {
  const Cart = sequelize.define("Cart", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    sessionId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  }, { tableName: "carts" });

  Cart.associate = (models) => {
    Cart.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Cart.hasMany(models.CartItem, { foreignKey: "cartId", as: "items" });
  };

  return Cart;
};
