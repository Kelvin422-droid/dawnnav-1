import path from "node:path";
import { importYaml, openDatabase } from "../lib/database.js";

const root = path.resolve(import.meta.dirname, "..");
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(root, "storage", "webstack.db");
const yamlPath = path.join(root, "data", "webstack.yml");
const db = openDatabase(databasePath);

try {
  const result = importYaml(db, yamlPath, { force: true });
  console.log(
    `已导入 ${result.categories} 个分类、${result.sections} 个子分类、${result.links} 条链接到 ${databasePath}`
  );
} finally {
  db.close();
}
