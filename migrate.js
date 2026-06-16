import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Sequelize } from "sequelize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  }
);

const command = process.argv[2] || "up";

async function ensureMigrationsTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations() {
  const [rows] = await sequelize.query(`SELECT name FROM "_migrations" ORDER BY name`);
  return new Set(rows.map((r) => r.name));
}

async function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".js")).sort();
  return files;
}

async function up() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = await getMigrationFiles();
  const pending = files.filter((f) => !executed.has(f));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  const qi = sequelize.getQueryInterface();

  for (const file of pending) {
    console.log(`Running: ${file}`);
    const migration = await import(new URL(`migrations/${file}`, import.meta.url));
    await migration.up(qi, Sequelize);
    await sequelize.query(`INSERT INTO "_migrations" (name) VALUES ($1)`, {
      bind: [file],
    });
    console.log(`  Done.`);
  }

  console.log(`\n${pending.length} migration(s) executed.`);
}

async function down() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = await getMigrationFiles();
  const executedFiles = files.filter((f) => executed.has(f));

  if (executedFiles.length === 0) {
    console.log("No migrations to undo.");
    return;
  }

  const last = executedFiles[executedFiles.length - 1];
  console.log(`Reverting: ${last}`);

  const qi = sequelize.getQueryInterface();
  const migration = await import(new URL(`migrations/${last}`, import.meta.url));
  await migration.down(qi, Sequelize);
  await sequelize.query(`DELETE FROM "_migrations" WHERE name = $1`, {
    bind: [last],
  });
  console.log(`  Reverted.`);
}

async function status() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = await getMigrationFiles();

  console.log("Migration Status:\n");
  for (const f of files) {
    const mark = executed.has(f) ? "✓" : "×";
    console.log(`  ${mark} ${f}`);
  }
  console.log(`\n${executed.size}/${files.length} executed.`);
}

async function run() {
  try {
    await sequelize.authenticate();
    if (command === "up") await up();
    else if (command === "down") await down();
    else if (command === "status") await status();
    else console.log("Usage: node migrate.js [up|down|status]");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
