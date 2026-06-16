export default (sequelize, Sequelize) => {
  const User = sequelize.define("User", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    phone: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    role: {
      type: Sequelize.ENUM("user", "admin"),
      defaultValue: "user",
    },
    status: {
      type: Sequelize.ENUM("active", "suspended"),
      defaultValue: "active",
    },
    emailVerified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    googleId: {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    },
    verificationToken: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    resetToken: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    resetTokenExpiry: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  }, { tableName: "users" });

  User.associate = (models) => {
    User.hasMany(models.UserAddress, { foreignKey: "userId", as: "addresses" });
    User.hasMany(models.UserVehicle, { foreignKey: "userId", as: "vehicles" });
    User.hasMany(models.Cart, { foreignKey: "userId", as: "carts" });
    User.hasMany(models.Order, { foreignKey: "userId", as: "orders" });
  };

  return User;
};
