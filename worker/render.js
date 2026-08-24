function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function translatedAttributes(prefix, zh, en) {
  const chinese = zh || "";
  const english = en || chinese;
  return `data-${prefix}-zh="${escapeHtml(chinese)}" data-${prefix}-en="${escapeHtml(english)}" lang="zh-CN"`;
}

function categoryId(categoryIndex) {
  return `category-${categoryIndex + 1}`;
}

function sectionId(categoryIndex, sectionIndex) {
  return `section-${categoryIndex + 1}-${sectionIndex + 1}`;
}

export function renderSidebar(categories) {
  return categories
    .map((category, categoryIndex) => {
      const taxonomyEn = category.taxonomy_en || category.taxonomy;
      const icon = escapeHtml(category.icon || "fa-star");
      const label = `<span class="title" ${translatedAttributes("sidebar-label", category.taxonomy, taxonomyEn)}>${escapeHtml(category.taxonomy)}</span>`;

      if (category.list) {
        const sections = category.list
          .map((section, sectionIndex) => {
            const termEn = section.term_en || section.term;
            return `<li><a href="#${sectionId(categoryIndex, sectionIndex)}" class="smooth"><span ${translatedAttributes("sidebar-label", section.term, termEn)}>${escapeHtml(section.term)}</span></a></li>`;
          })
          .join("");
        return `<li><a><i class="fa ${icon} fa-fw"></i>${label}</a><ul>${sections}</ul></li>`;
      }

      return `<li><a href="#${categoryId(categoryIndex)}" class="smooth"><i class="fa ${icon} fa-fw"></i>${label}</a></li>`;
    })
    .join("");
}

function renderCard(link) {
  const titleEn = link.title_en || link.title;
  const description = link.description || "";
  const descriptionEn = link.description_en || description;
  const classes = `xe-card col-xs-6 col-sm-4 col-md-3${link.qrcode ? " qrcode" : ""} geticon`;
  const tooltip = link.qrcode
    ? `data-html="true" title="&lt;img src='${escapeHtml(link.qrcode)}' width='128'&gt;"`
    : `title="${escapeHtml(`${description} ${link.url}`.trim())}" ${translatedAttributes("language-title", `${description} ${link.url}`.trim(), `${descriptionEn} ${link.url}`.trim())}`;

  return `<div class="${classes}"><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="xe-widget xe-conversations box2 label-info" data-toggle="tooltip" data-placement="bottom" ${tooltip}><div class="xe-comment-entry"><div class="xe-user-img"><img class="img-circle lazy" src="./images/favicon.png" data-src="${escapeHtml(link.logo || "")}" onerror="this.src='./images/favicon.png'" width="40" alt=""></div><div class="xe-comment"><div class="xe-user-name overflowClip_1"><strong ${translatedAttributes("language-label", link.title, titleEn)}>${escapeHtml(link.title)}</strong></div><p class="overflowClip_2" ${translatedAttributes("language-label", description, descriptionEn)}>${escapeHtml(description)}</p></div></div></a></div>`;
}

function renderHeading(icon, id, name, nameEn) {
  return `<h4 class="text-gray" style="display: inline-block;"><i class="fa ${escapeHtml(icon || "fa-star")}" style="margin-right: 27px;" id="${id}"></i><span ${translatedAttributes("language-label", name, nameEn || name)}>${escapeHtml(name)}</span></h4>`;
}

export function renderContent(categories) {
  return categories
    .map((category, categoryIndex) => {
      if (category.list) {
        return category.list
          .map((section, sectionIndex) => {
            const heading = renderHeading(
              category.icon,
              sectionId(categoryIndex, sectionIndex),
              section.term,
              section.term_en
            );
            return `${heading}<div class="row">${section.links.map(renderCard).join("")}</div><br>`;
          })
          .join("");
      }

      const heading = renderHeading(
        category.icon,
        categoryId(categoryIndex),
        category.taxonomy,
        category.taxonomy_en
      );
      const cards = (category.links || []).map(renderCard).join("");
      const friends = (category.friend || [])
        .map((friend) => {
          const titleEn = friend.title_en || friend.title;
          const description = friend.description || "";
          const descriptionEn = friend.description_en || description;
          return `<a href="${escapeHtml(friend.url)}" rel="noopener noreferrer" title="${escapeHtml(description)}" target="_blank" ${translatedAttributes("language-title", description, descriptionEn)} ${translatedAttributes("language-label", friend.title, titleEn)}>${escapeHtml(friend.title)}</a>`;
        })
        .join("");
      const friendPanel = friends
        ? `<div class="friendlink" style="margin-bottom:-40px"><div class="panel">${friends}</div></div>`
        : "";
      return `${heading}<div class="row">${cards}</div><br>${friendPanel}`;
    })
    .join("");
}

const SIDEBAR_PATTERN = /<li[^>]*data-dynamic-sidebar-start[^>]*><\/li>[\s\S]*?<li[^>]*data-dynamic-sidebar-end[^>]*><\/li>/;
const CONTENT_PATTERN = /<div[^>]*data-dynamic-content-start[^>]*><\/div>[\s\S]*?<div[^>]*data-dynamic-content-end[^>]*><\/div>/;

function replaceMetaContent(html, attribute, value) {
  const escapedValue = escapeHtml(value);
  const pattern = new RegExp(`(<meta[^>]+(?:property|name)=["']${attribute}["'][^>]+content=["'])[^"']*(["'][^>]*>)`, "i");
  return html.replace(pattern, `$1${escapedValue}$2`);
}

export function injectWebstack(html, categories, requestUrl = null) {
  if (!SIDEBAR_PATTERN.test(html) || !CONTENT_PATTERN.test(html)) {
    throw new Error("首页缺少动态内容标记，请先重新运行 Hugo 构建");
  }

  let rendered = html
    .replace(
      SIDEBAR_PATTERN,
      `<li data-dynamic-sidebar-start hidden></li>${renderSidebar(categories)}<li data-dynamic-sidebar-end hidden></li>`
    )
    .replace(
      CONTENT_PATTERN,
      `<div data-dynamic-content-start hidden></div>${renderContent(categories)}<div data-dynamic-content-end hidden></div>`
    );

  if (requestUrl) {
    const pageUrl = new URL(requestUrl);
    const homeUrl = `${pageUrl.origin}/`;
    const imageUrl = `${pageUrl.origin}/images/og.png`;
    rendered = replaceMetaContent(rendered, "og:url", homeUrl);
    rendered = replaceMetaContent(rendered, "og:image", imageUrl);
    rendered = replaceMetaContent(rendered, "twitter:image", imageUrl);
  }

  return rendered;
}
