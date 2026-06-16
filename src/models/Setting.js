export default (sequelize, Sequelize) => {
  const Setting = sequelize.define("Setting", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: Sequelize.JSONB,
      allowNull: false,
    },
  }, { tableName: "settings" });

  Setting.associate = () => {};

  return Setting;
};
