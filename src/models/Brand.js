export default (sequelize, Sequelize) => {
  const Brand = sequelize.define("Brand", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    slug: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
  }, { tableName: "brands" });

  // No associations — Brand is reference data only (products come from RIDEX)

  return Brand;
};
