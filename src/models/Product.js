export default (sequelize, Sequelize) => {
  const Product = sequelize.define("Product", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    articleNo: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    articleId: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    brand: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: "RIDEX",
    },
    ridexPrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    },
    ridexQuantity: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    categoryId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    ridexCategorySlug: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    ridexUrl: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    ean: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    lastSyncedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    searchVector: {
      type: Sequelize.TSVECTOR,
      allowNull: true,
    },
  }, { tableName: "products" });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    Product.hasMany(models.ProductImage, { foreignKey: "productId", as: "images" });
    Product.hasMany(models.ProductSpec, { foreignKey: "productId", as: "specs" });
    Product.hasMany(models.OemNumber, { foreignKey: "productId", as: "oemNumbers" });
    Product.hasMany(models.ProductVehicle, { foreignKey: "productId", as: "vehicles" });
  };

  return Product;
};
