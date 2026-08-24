import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import yaml from "../vendor/js-yaml.mjs";
import {
  countLinks,
  flattenWebstack,
  rowsToWebstack
} from "../worker/webstack-data.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    icon TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('links', 'list', 'friend')),
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    section_id INTEGER,
    kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'friend')),
    title TEXT NOT NULL,
    title_en TEXT,
    url TEXT NOT NULL,
    description TEXT,
    description_en TEXT,
    logo TEXT,
    qrcode TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sections_category_sort
    ON sections(category_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_links_category_section_sort
    ON links(category_id, section_id, sort_order)`
];

export function openDatabase(databasePath) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  SCHEMA.forEach((statement) => db.prepare(statement).run());
  db.exec("PRAGMA optimize");
  return db;
}

export function readWebstack(db) {
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order, id")
    .all();
  const sections = db
    .prepare("SELECT * FROM sections ORDER BY category_id, sort_order, id")
    .all();
  const links = db
    .prepare(
      "SELECT * FROM links ORDER BY category_id, section_id, sort_order, id"
    )
    .all();
  return rowsToWebstack(categories, sections, links);
}

export function replaceWebstack(db, input) {
  const rows = flattenWebstack(input);
  const insertCategory = db.prepare(
    "INSERT INTO categories (id, name, name_en, icon, mode, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertSection = db.prepare(
    "INSERT INTO sections (id, category_id, name, name_en, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  const insertLink = db.prepare(
    `INSERT INTO links (
      id, category_id, section_id, kind, title, title_en, url,
      description, description_en, logo, qrcode, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM links").run();
    db.prepare("DELETE FROM sections").run();
    db.prepare("DELETE FROM categories").run();

    rows.categories.forEach((row) =>
      insertCategory.run(
        row.id,
        row.name,
        row.name_en,
        row.icon,
        row.mode,
        row.sort_order
      )
    );
    rows.sections.forEach((row) =>
      insertSection.run(
        row.id,
        row.category_id,
        row.name,
        row.name_en,
        row.sort_order
      )
    );
    rows.links.forEach((row) =>
      insertLink.run(
        row.id,
        row.category_id,
        row.section_id,
        row.kind,
        row.title,
        row.title_en,
        row.url,
        row.description,
        row.description_en,
        row.logo,
        row.qrcode,
        row.sort_order
      )
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    categories: rows.categories.length,
    sections: rows.sections.length,
    links: rows.links.length
  };
}

export function importYaml(db, yamlPath, { force = false } = {}) {
  const currentCount = Number(
    db.prepare("SELECT COUNT(*) AS count FROM categories").get().count
  );
  if (currentCount > 0 && !force) {
    const data = readWebstack(db);
    return { imported: false, categories: data.length, links: countLinks(data) };
  }

  const parsed = yaml.load(fs.readFileSync(yamlPath, "utf8"));
  return { imported: true, ...replaceWebstack(db, parsed) };
}
