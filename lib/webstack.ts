import { asc } from "drizzle-orm";
import { getD1, getDb } from "@/db";
import { categories as categoriesTable, links as linksTable, sections as sectionsTable } from "@/db/schema";
import seedData from "@/app/_generated/webstack.seed.json";

export type CategoryMode = "links" | "list" | "friend";

export interface LinkItem {
  title: string;
  title_en?: string | null;
  url: string;
  description?: string | null;
  description_en?: string | null;
  logo?: string | null;
  qrcode?: string | null;
}

export interface LinkSection {
  term: string;
  term_en?: string | null;
  links: LinkItem[];
}

export interface WebstackCategory {
  taxonomy: string;
  taxonomy_en?: string | null;
  icon?: string | null;
  links?: LinkItem[];
  list?: LinkSection[];
  friend?: LinkItem[];
}

const modes = new Set<CategoryMode>(["links", "list", "friend"]);

function optionalText(value: unknown, field: string, maxLength = 20_000): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new TypeError(`${field} 必须是字符串`);
  if (value.length > maxLength) throw new RangeError(`${field} 超过最大长度 ${maxLength}`);
  return value;
}

function requiredText(value: unknown, field: string, maxLength = 20_000): string {
  const result = optionalText(value, field, maxLength);
  if (!result?.trim()) throw new TypeError(`${field} 不能为空`);
  return result;
}

function normalizeLink(value: unknown, field: string): LinkItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} 必须是对象`);
  }
  const link = value as Record<string, unknown>;
  return {
    title: requiredText(link.title, `${field}.title`, 500),
    title_en: optionalText(link.title_en, `${field}.title_en`, 500),
    url: requiredText(link.url, `${field}.url`, 4_000),
    description: optionalText(link.description, `${field}.description`),
    description_en: optionalText(link.description_en, `${field}.description_en`),
    logo: optionalText(link.logo, `${field}.logo`, 4_000),
    qrcode: optionalText(link.qrcode, `${field}.qrcode`, 4_000)
  };
}

export function categoryMode(category: WebstackCategory): CategoryMode {
  if (Array.isArray(category.list)) return "list";
  if (Array.isArray(category.friend)) return "friend";
  return "links";
}

export function normalizeWebstack(value: unknown): WebstackCategory[] {
  if (!Array.isArray(value)) throw new TypeError("数据顶层必须是数组");
  if (value.length > 1_000) throw new RangeError("分类数量不能超过 1000");

  let totalLinks = 0;
  const normalized = value.map((rawCategory, categoryIndex) => {
    const field = `categories[${categoryIndex}]`;
    if (!rawCategory || typeof rawCategory !== "object" || Array.isArray(rawCategory)) {
      throw new TypeError(`${field} 必须是对象`);
    }
    const category = rawCategory as Record<string, unknown>;
    const detected: CategoryMode = Array.isArray(category.list)
      ? "list"
      : Array.isArray(category.friend)
        ? "friend"
        : "links";
    const requested = typeof category.mode === "string" ? category.mode : detected;
    const mode = modes.has(requested as CategoryMode) ? (requested as CategoryMode) : detected;
    const result: WebstackCategory = {
      taxonomy: requiredText(category.taxonomy, `${field}.taxonomy`, 500),
      taxonomy_en: optionalText(category.taxonomy_en, `${field}.taxonomy_en`, 500),
      icon: optionalText(category.icon, `${field}.icon`, 100) ?? "fa-star"
    };

    if (mode === "list") {
      const sections = Array.isArray(category.list) ? category.list : [];
      result.list = sections.map((rawSection, sectionIndex) => {
        const sectionField = `${field}.list[${sectionIndex}]`;
        if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
          throw new TypeError(`${sectionField} 必须是对象`);
        }
        const section = rawSection as Record<string, unknown>;
        const rawLinks = Array.isArray(section.links) ? section.links : [];
        totalLinks += rawLinks.length;
        return {
          term: requiredText(section.term, `${sectionField}.term`, 500),
          term_en: optionalText(section.term_en, `${sectionField}.term_en`, 500),
          links: rawLinks.map((link, index) => normalizeLink(link, `${sectionField}.links[${index}]`))
        };
      });
    } else {
      const property = mode === "friend" ? "friend" : "links";
      const rawLinks = Array.isArray(category[property]) ? category[property] : [];
      totalLinks += rawLinks.length;
      result[property] = rawLinks.map((link, index) => normalizeLink(link, `${field}.${property}[${index}]`));
    }
    return result;
  });

  if (totalLinks > 20_000) throw new RangeError("链接数量不能超过 20000");
  return normalized;
}

export function countLinks(data: WebstackCategory[]): number {
  return data.reduce((total, category) => {
    const direct = category.links?.length ?? category.friend?.length ?? 0;
    const nested = category.list?.reduce((sum, section) => sum + section.links.length, 0) ?? 0;
    return total + direct + nested;
  }, 0);
}

let schemaReady: Promise<void> | undefined;

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const d1 = getD1();
    schemaReady = d1.batch([
      d1.prepare("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, name_en TEXT, icon TEXT, mode TEXT NOT NULL, sort_order INTEGER DEFAULT 0 NOT NULL)"),
      d1.prepare("CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, name TEXT NOT NULL, name_en TEXT, sort_order INTEGER DEFAULT 0 NOT NULL)"),
      d1.prepare("CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE, kind TEXT DEFAULT 'link' NOT NULL, title TEXT NOT NULL, title_en TEXT, url TEXT NOT NULL, description TEXT, description_en TEXT, logo TEXT, qrcode TEXT, sort_order INTEGER DEFAULT 0 NOT NULL)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_sections_category_sort ON sections(category_id, sort_order)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_links_category_section_sort ON links(category_id, section_id, sort_order)")
    ]).then(() => undefined).catch((error: unknown) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

export async function readWebstack(): Promise<WebstackCategory[]> {
  await ensureSchema();
  const db = getDb();
  const [categoryRows, sectionRows, linkRows] = await Promise.all([
    db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.id)),
    db.select().from(sectionsTable).orderBy(asc(sectionsTable.categoryId), asc(sectionsTable.sortOrder), asc(sectionsTable.id)),
    db.select().from(linksTable).orderBy(asc(linksTable.categoryId), asc(linksTable.sectionId), asc(linksTable.sortOrder), asc(linksTable.id))
  ]);

  const categoryById = new Map<number, WebstackCategory>();
  const sectionById = new Map<number, LinkSection>();
  const result = categoryRows.map((row) => {
    const category: WebstackCategory = {
      taxonomy: row.name,
      taxonomy_en: row.nameEn,
      icon: row.icon
    };
    if (row.mode === "list") category.list = [];
    else if (row.mode === "friend") category.friend = [];
    else category.links = [];
    categoryById.set(row.id, category);
    return category;
  });

  for (const row of sectionRows) {
    const section: LinkSection = { term: row.name, term_en: row.nameEn, links: [] };
    sectionById.set(row.id, section);
    categoryById.get(row.categoryId)?.list?.push(section);
  }

  for (const row of linkRows) {
    const link: LinkItem = {
      title: row.title,
      title_en: row.titleEn,
      url: row.url,
      description: row.description,
      description_en: row.descriptionEn,
      logo: row.logo,
      qrcode: row.qrcode
    };
    if (row.sectionId !== null) sectionById.get(row.sectionId)?.links.push(link);
    else if (row.kind === "friend") categoryById.get(row.categoryId)?.friend?.push(link);
    else categoryById.get(row.categoryId)?.links?.push(link);
  }
  return result;
}

export async function replaceWebstack(value: unknown) {
  const data = normalizeWebstack(value);
  const d1 = getD1();
  await ensureSchema();
  const statements: D1PreparedStatement[] = [
    d1.prepare("DELETE FROM links"),
    d1.prepare("DELETE FROM sections"),
    d1.prepare("DELETE FROM categories")
  ];
  let sectionId = 1;
  let linkId = 1;

  data.forEach((category, categoryIndex) => {
    const categoryId = categoryIndex + 1;
    const mode = categoryMode(category);
    statements.push(
      d1.prepare("INSERT INTO categories (id, name, name_en, icon, mode, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(categoryId, category.taxonomy, category.taxonomy_en ?? null, category.icon ?? "fa-star", mode, categoryIndex)
    );
    const appendLinks = (items: LinkItem[], currentSectionId: number | null, kind: "link" | "friend") => {
      items.forEach((link, sortOrder) => {
        statements.push(
          d1.prepare("INSERT INTO links (id, category_id, section_id, kind, title, title_en, url, description, description_en, logo, qrcode, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(linkId++, categoryId, currentSectionId, kind, link.title, link.title_en ?? null, link.url, link.description ?? null, link.description_en ?? null, link.logo ?? null, link.qrcode ?? null, sortOrder)
        );
      });
    };

    if (mode === "list") {
      category.list?.forEach((section, sectionIndex) => {
        const currentSectionId = sectionId++;
        statements.push(
          d1.prepare("INSERT INTO sections (id, category_id, name, name_en, sort_order) VALUES (?, ?, ?, ?, ?)")
            .bind(currentSectionId, categoryId, section.term, section.term_en ?? null, sectionIndex)
        );
        appendLinks(section.links, currentSectionId, "link");
      });
    } else if (mode === "friend") appendLinks(category.friend ?? [], null, "friend");
    else appendLinks(category.links ?? [], null, "link");
  });

  await d1.batch(statements);
  return { categories: data.length, links: countLinks(data) };
}

export async function ensureSeeded(): Promise<void> {
  await ensureSchema();
  const row = await getD1().prepare("SELECT COUNT(*) AS count FROM categories").first<{ count: number }>();
  if (Number(row?.count ?? 0) === 0) await replaceWebstack(seedData);
}
