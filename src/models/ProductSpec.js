export default (sequelize, Sequelize) => {
  const ProductSpec = sequelize.define("ProductSpec", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    specKey: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    specValue: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  }, { tableName: "product_specs" });

  ProductSpec.associate = (models) => {
    ProductSpec.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
  };

  return ProductSpec;
};
