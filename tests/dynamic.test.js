import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import yaml from "../vendor/js-yaml.mjs";
import { importYaml, openDatabase, readWebstack } from "../lib/database.js";
import { countLinks, flattenWebstack } from "../worker/webstack-data.js";
import { injectWebstack } from "../worker/render.js";

const root = path.resolve(import.meta.dirname, "..");
const yamlPath = path.join(root, "data", "webstack.yml");

test("YAML 数据能完整转换为关系表", () => {
  const source = yaml.load(fs.readFileSync(yamlPath, "utf8"));
  const rows = flattenWebstack(source);
  assert.equal(rows.categories.length, 8);
  assert.equal(rows.sections.length, 7);
  assert.equal(rows.links.length, 789);
});

test("SQLite 导入后能恢复原有嵌套结构", () => {
  const db = openDatabase(":memory:");
  try {
    importYaml(db, yamlPath, { force: true });
    const restored = readWebstack(db);
    assert.equal(restored.length, 8);
    assert.equal(countLinks(restored), 789);
    assert.equal(restored[0].taxonomy, "新闻和媒体");
    assert.equal(restored[2].list.length, 7);
  } finally {
    db.close();
  }
});

test("D1 迁移文件可以创建数据库结构", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const migration = fs.readFileSync(path.join(root, "drizzle", "0000_webstack.sql"), "utf8");
    migration.split("--> statement-breakpoint").forEach((statement) => db.exec(statement));
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name);
    assert.ok(tables.includes("categories"));
    assert.ok(tables.includes("sections"));
    assert.ok(tables.includes("links"));
  } finally {
    db.close();
  }
});

test("服务端渲染会替换动态区域并转义数据", () => {
  const shell = `<ul><li data-dynamic-sidebar-start hidden></li><li data-dynamic-sidebar-end hidden></li></ul><main><div data-dynamic-content-start hidden></div><div data-dynamic-content-end hidden></div></main>`;
  const data = [{ taxonomy: "<测试>", icon: "fa-star", links: [{ title: "站点", url: "https://example.com/?a=1&b=2", description: "说明" }] }];
  const rendered = injectWebstack(shell, data);
  assert.match(rendered, /&lt;测试&gt;/);
  assert.match(rendered, /https:\/\/example\.com\/\?a=1&amp;b=2/);
  assert.doesNotMatch(rendered, /<测试>/);
});
