export default (sequelize, Sequelize) => {
  const CartItem = sequelize.define("CartItem", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    cartId: {
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
    image: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unitPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
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
  }, { tableName: "cart_items" });

  CartItem.associate = (models) => {
    CartItem.belongsTo(models.Cart, { foreignKey: "cartId", as: "cart" });
    CartItem.belongsTo(models.Kit, { foreignKey: "kitId", as: "kit" });
  };

  return CartItem;
};
