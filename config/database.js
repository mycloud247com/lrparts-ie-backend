import { Sequelize } from "sequelize";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

class DB {
  static instance = null;

  constructor() {
    if (DB.instance) return DB.instance;
    DB.instance = this;

    this.sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "postgres",
        logging: false,
        define: {
          freezeTableName: true,
          underscored: true,
        },
      },
    );

    this.Sequelize = Sequelize;
    this.models = {};
    this._modelsLoaded = false;
  }

  async loadModels() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const modelDir = path.join(__dirname, "..", "src", "models");
    const files = fs.readdirSync(modelDir);

    for (const file of files) {
      if (file.endsWith(".js") && file !== "index.js") {
        const module = await import(new URL(`../src/models/${file}`, import.meta.url));
        const modelFactory = module.default;
        const model = modelFactory(this.sequelize, Sequelize);
        this.models[model.name] = model;
        this[model.name] = model;
      }
    }
  }

  setupAssociations() {
    for (const modelName of Object.keys(this.models)) {
      if (typeof this.models[modelName].associate === "function") {
        this.models[modelName].associate(this.models);
      }
    }
  }

  async initiate() {
    if (!this._modelsLoaded) {
      await this.loadModels();
      this.setupAssociations();
      Object.assign(this, this.models);
      this._modelsLoaded = true;
    }
    await this.sequelize.authenticate();
  }

  async close() {
    await this.sequelize.close();
  }
}

export default DB;
