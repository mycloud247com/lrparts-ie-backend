export default (sequelize, Sequelize) => {
  const SyncLog = sequelize.define("SyncLog", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM("running", "completed", "failed"),
      defaultValue: "running",
    },
    itemsProcessed: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    errors: {
      type: Sequelize.JSONB,
      allowNull: true,
    },
    startedAt: {
      type: Sequelize.DATE,
    },
    completedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  }, { tableName: "sync_logs" });

  SyncLog.associate = () => {};

  return SyncLog;
};
