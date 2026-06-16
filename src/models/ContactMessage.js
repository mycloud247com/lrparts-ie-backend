export default (sequelize, Sequelize) => {
  const ContactMessage = sequelize.define("ContactMessage", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    subject: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    message: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM("new", "read", "replied", "archived"),
      defaultValue: "new",
    },
    adminNote: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
  }, { tableName: "contact_messages" });

  ContactMessage.associate = () => {};

  return ContactMessage;
};
