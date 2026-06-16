export default (sequelize, Sequelize) => {
  const OemNumber = sequelize.define("OemNumber", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    oemNumber: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  }, { tableName: "oem_numbers" });

  OemNumber.associate = (models) => {
    OemNumber.belongsTo(models.Product, { foreignKey: "productId", as: "product" });
  };

  return OemNumber;
};
