import {
  countLinks,
  flattenWebstack,
  rowsToWebstack
} from "./webstack-data.js";

export async function readWebstack(db) {
  const [categoryResult, sectionResult, linkResult] = await db.batch([
    db.prepare("SELECT * FROM categories ORDER BY sort_order, id"),
    db.prepare("SELECT * FROM sections ORDER BY category_id, sort_order, id"),
    db.prepare("SELECT * FROM links ORDER BY category_id, section_id, sort_order, id")
  ]);
  return rowsToWebstack(
    categoryResult.results || [],
    sectionResult.results || [],
    linkResult.results || []
  );
}

export async function replaceWebstack(db, input) {
  const rows = flattenWebstack(input);
  const statements = [
    db.prepare("DELETE FROM links"),
    db.prepare("DELETE FROM sections"),
    db.prepare("DELETE FROM categories")
  ];

  rows.categories.forEach((row) => {
    statements.push(
      db.prepare(
        "INSERT INTO categories (id, name, name_en, icon, mode, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(row.id, row.name, row.name_en, row.icon, row.mode, row.sort_order)
    );
  });
  rows.sections.forEach((row) => {
    statements.push(
      db.prepare(
        "INSERT INTO sections (id, category_id, name, name_en, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(row.id, row.category_id, row.name, row.name_en, row.sort_order)
    );
  });
  rows.links.forEach((row) => {
    statements.push(
      db.prepare(
        `INSERT INTO links (
          id, category_id, section_id, kind, title, title_en, url,
          description, description_en, logo, qrcode, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
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
  });

  await db.batch(statements);
  return {
    categories: rows.categories.length,
    sections: rows.sections.length,
    links: rows.links.length
  };
}

export async function ensureSeeded(db, assets, requestUrl) {
  const result = await db.prepare("SELECT COUNT(*) AS count FROM categories").first();
  if (Number(result?.count || 0) > 0) return;

  const seedResponse = await assets.fetch(
    new Request(new URL("/webstack.seed.json", requestUrl))
  );
  if (!seedResponse.ok) throw new Error("无法读取数据库初始数据");
  await replaceWebstack(db, await seedResponse.json());
}

export { countLinks };
