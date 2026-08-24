import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  icon: text("icon"),
  mode: text("mode", { enum: ["links", "list", "friend"] }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0)
});

export const sections = sqliteTable(
  "sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => [
    index("idx_sections_category_sort").on(table.categoryId, table.sortOrder)
  ]
);

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    sectionId: integer("section_id").references(() => sections.id, {
      onDelete: "cascade"
    }),
    kind: text("kind", { enum: ["link", "friend"] })
      .notNull()
      .default("link"),
    title: text("title").notNull(),
    titleEn: text("title_en"),
    url: text("url").notNull(),
    description: text("description"),
    descriptionEn: text("description_en"),
    logo: text("logo"),
    qrcode: text("qrcode"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => [
    index("idx_links_category_section_sort").on(
      table.categoryId,
      table.sectionId,
      table.sortOrder
    )
  ]
);
