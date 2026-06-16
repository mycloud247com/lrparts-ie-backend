export default (sequelize, Sequelize) => {
  const ScrapeProgress = sequelize.define("ScrapeProgress", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    vehicleEngineId: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    phase: {
      type: Sequelize.ENUM("scrape", "enrich"),
      allowNull: false,
    },
    status: {
      type: Sequelize.ENUM("pending", "in_progress", "completed", "failed"),
      defaultValue: "pending",
    },
    productsFound: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    errorMessage: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    startedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    completedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
  }, { tableName: "scrape_progress" });

  ScrapeProgress.associate = (models) => {
    ScrapeProgress.belongsTo(models.VehicleEngine, { foreignKey: "vehicleEngineId", as: "engine" });
  };

  return ScrapeProgress;
};
