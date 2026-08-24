const MODES = new Set(["links", "list", "friend"]);

function optionalText(value, field, maxLength = 20000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new TypeError(`${field} 必须是字符串`);
  }
  if (value.length > maxLength) {
    throw new RangeError(`${field} 超过最大长度 ${maxLength}`);
  }
  return value;
}

function requiredText(value, field, maxLength = 20000) {
  const text = optionalText(value, field, maxLength);
  if (!text || !text.trim()) throw new TypeError(`${field} 不能为空`);
  return text;
}

function normalizeLink(link, field) {
  if (!link || typeof link !== "object" || Array.isArray(link)) {
    throw new TypeError(`${field} 必须是对象`);
  }

  return {
    title: requiredText(link.title, `${field}.title`, 500),
    title_en: optionalText(link.title_en, `${field}.title_en`, 500),
    url: requiredText(link.url, `${field}.url`, 4000),
    description: optionalText(link.description, `${field}.description`),
    description_en: optionalText(link.description_en, `${field}.description_en`),
    logo: optionalText(link.logo, `${field}.logo`, 4000),
    qrcode: optionalText(link.qrcode, `${field}.qrcode`, 4000)
  };
}

export function normalizeWebstack(input) {
  if (!Array.isArray(input)) throw new TypeError("数据顶层必须是数组");
  if (input.length > 1000) throw new RangeError("分类数量不能超过 1000");

  let linkCount = 0;
  const categories = input.map((category, categoryIndex) => {
    const field = `categories[${categoryIndex}]`;
    if (!category || typeof category !== "object" || Array.isArray(category)) {
      throw new TypeError(`${field} 必须是对象`);
    }

    const detectedMode = Array.isArray(category.list)
      ? "list"
      : Array.isArray(category.friend)
        ? "friend"
        : "links";
    const mode = MODES.has(category.mode) ? category.mode : detectedMode;
    const normalized = {
      taxonomy: requiredText(category.taxonomy, `${field}.taxonomy`, 500),
      taxonomy_en: optionalText(category.taxonomy_en, `${field}.taxonomy_en`, 500),
      icon: optionalText(category.icon, `${field}.icon`, 100) || "fa-star"
    };

    if (mode === "list") {
      const list = Array.isArray(category.list) ? category.list : [];
      normalized.list = list.map((section, sectionIndex) => {
        const sectionField = `${field}.list[${sectionIndex}]`;
        const rawLinks = Array.isArray(section?.links) ? section.links : [];
        linkCount += rawLinks.length;
        return {
          term: requiredText(section?.term, `${sectionField}.term`, 500),
          term_en: optionalText(section?.term_en, `${sectionField}.term_en`, 500),
          links: rawLinks.map((link, linkIndex) =>
            normalizeLink(link, `${sectionField}.links[${linkIndex}]`)
          )
        };
      });
    } else {
      const property = mode === "friend" ? "friend" : "links";
      const rawLinks = Array.isArray(category[property]) ? category[property] : [];
      linkCount += rawLinks.length;
      normalized[property] = rawLinks.map((link, linkIndex) =>
        normalizeLink(link, `${field}.${property}[${linkIndex}]`)
      );
    }

    return normalized;
  });

  if (linkCount > 20000) throw new RangeError("链接数量不能超过 20000");
  return categories;
}

export function flattenWebstack(input) {
  const categories = normalizeWebstack(input);
  const categoryRows = [];
  const sectionRows = [];
  const linkRows = [];
  let sectionId = 1;
  let linkId = 1;

  categories.forEach((category, categoryIndex) => {
    const categoryId = categoryIndex + 1;
    const mode = category.list ? "list" : category.friend ? "friend" : "links";
    categoryRows.push({
      id: categoryId,
      name: category.taxonomy,
      name_en: category.taxonomy_en,
      icon: category.icon,
      mode,
      sort_order: categoryIndex
    });

    const appendLinks = (items, currentSectionId, kind) => {
      items.forEach((link, sortOrder) => {
        linkRows.push({
          id: linkId++,
          category_id: categoryId,
          section_id: currentSectionId,
          kind,
          title: link.title,
          title_en: link.title_en,
          url: link.url,
          description: link.description,
          description_en: link.description_en,
          logo: link.logo,
          qrcode: link.qrcode,
          sort_order: sortOrder
        });
      });
    };

    if (mode === "list") {
      category.list.forEach((section, sectionIndex) => {
        const currentSectionId = sectionId++;
        sectionRows.push({
          id: currentSectionId,
          category_id: categoryId,
          name: section.term,
          name_en: section.term_en,
          sort_order: sectionIndex
        });
        appendLinks(section.links, currentSectionId, "link");
      });
    } else if (mode === "friend") {
      appendLinks(category.friend, null, "friend");
    } else {
      appendLinks(category.links, null, "link");
    }
  });

  return { categories: categoryRows, sections: sectionRows, links: linkRows };
}

export function rowsToWebstack(categoryRows, sectionRows, linkRows) {
  const sectionById = new Map();
  const categoryById = new Map();

  const categories = categoryRows.map((row) => {
    const category = {
      taxonomy: row.name,
      taxonomy_en: row.name_en ?? null,
      icon: row.icon ?? "fa-star"
    };
    if (row.mode === "list") category.list = [];
    else if (row.mode === "friend") category.friend = [];
    else category.links = [];
    categoryById.set(Number(row.id), category);
    return category;
  });

  sectionRows.forEach((row) => {
    const section = {
      term: row.name,
      term_en: row.name_en ?? null,
      links: []
    };
    sectionById.set(Number(row.id), section);
    categoryById.get(Number(row.category_id))?.list?.push(section);
  });

  linkRows.forEach((row) => {
    const link = {
      title: row.title,
      title_en: row.title_en ?? null,
      url: row.url,
      description: row.description ?? null,
      description_en: row.description_en ?? null
    };
    if (row.logo) link.logo = row.logo;
    if (row.qrcode) link.qrcode = row.qrcode;

    if (row.section_id !== null && row.section_id !== undefined) {
      sectionById.get(Number(row.section_id))?.links.push(link);
    } else {
      const category = categoryById.get(Number(row.category_id));
      if (row.kind === "friend") category?.friend?.push(link);
      else category?.links?.push(link);
    }
  });

  return categories;
}

export function countLinks(categories) {
  return categories.reduce((total, category) => {
    const direct = category.links?.length || category.friend?.length || 0;
    const nested = (category.list || []).reduce(
      (sectionTotal, section) => sectionTotal + (section.links?.length || 0),
      0
    );
    return total + direct + nested;
  }, 0);
}
