export default (sequelize, Sequelize) => {
  const ProductImage = sequelize.define("ProductImage", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    url: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    sortOrder: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    isPrimary: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  }, { tableName: "product_images" });

  ProductImage.associate = (models) => {
    ProductImage.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
  };

  return ProductImage;
};
