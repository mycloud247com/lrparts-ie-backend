export async function up(qi, Sequelize) {
  await qi.sequelize.query(`CREATE TYPE "enum_contact_messages_status" AS ENUM ('new', 'read', 'replied', 'archived');`).catch(() => {});

  await qi.createTable("contact_messages", {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    email: { type: Sequelize.STRING, allowNull: false },
    subject: { type: Sequelize.STRING, allowNull: false },
    message: { type: Sequelize.TEXT, allowNull: false },
    status: { type: "enum_contact_messages_status", defaultValue: "new" },
    admin_note: { type: Sequelize.TEXT, allowNull: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  });
}

export async function down(qi) {
  await qi.dropTable("contact_messages");
  await qi.sequelize.query(`DROP TYPE IF EXISTS "enum_contact_messages_status";`).catch(() => {});
}
