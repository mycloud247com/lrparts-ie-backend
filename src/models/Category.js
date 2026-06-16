export default (sequelize, Sequelize) => {
  const Category = sequelize.define("Category", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    parentId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    sortOrder: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
  }, { tableName: "categories" });

  Category.associate = (models) => {
    Category.belongsTo(models.Category, { foreignKey: "parentId", as: "parent" });
    Category.hasMany(models.Category, { foreignKey: "parentId", as: "children" });
  };

  return Category;
};
