export default (sequelize, Sequelize) => {
  const UserAddress = sequelize.define("UserAddress", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    label: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    firstName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    addressLine1: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    addressLine2: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    city: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    county: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    eircode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    phone: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isDefault: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  }, { tableName: "user_addresses" });

  UserAddress.associate = (models) => {
    UserAddress.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return UserAddress;
};
