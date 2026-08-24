"use client";

import { useEffect, useMemo, useState } from "react";
import type { LinkItem, LinkSection, WebstackCategory } from "@/lib/webstack";

type Language = "zh" | "en";

function countCategory(category: WebstackCategory) {
  return (category.links?.length ?? category.friend?.length ?? 0) +
    (category.list?.reduce((sum, section) => sum + section.links.length, 0) ?? 0);
}

function text(primary: string | null | undefined, secondary: string | null | undefined, language: Language) {
  return language === "en" ? secondary || primary || "" : primary || secondary || "";
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function initials(title: string) {
  const clean = title.trim();
  if (!clean) return "DN";
  return clean.slice(0, 2).toUpperCase();
}

function SiteCard({ item, language, index }: { item: LinkItem; language: Language; index: number }) {
  const title = text(item.title, item.title_en, language);
  const description = text(item.description, item.description_en, language);
  return (
    <a className="site-card" href={item.url} target="_blank" rel="noopener noreferrer">
      <span className={`site-mark tone-${index % 6}`} aria-hidden="true">
        {item.logo ? <img src={item.logo} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <b>{initials(title)}</b>
      </span>
      <span className="site-copy">
        <span className="site-title-row"><strong>{title}</strong><span aria-hidden="true">↗</span></span>
        <span className="site-host">{hostname(item.url)}</span>
        {description ? <span className="site-description">{description}</span> : null}
      </span>
    </a>
  );
}

function filterItems(items: LinkItem[], query: string) {
  if (!query) return items;
  const needle = query.toLocaleLowerCase();
  return items.filter((item) => [item.title, item.title_en, item.description, item.description_en, item.url]
    .some((value) => value?.toLocaleLowerCase().includes(needle)));
}

function filterSections(sections: LinkSection[], query: string) {
  return sections.map((section) => ({ ...section, links: filterItems(section.links, query) }))
    .filter((section) => section.links.length > 0);
}

export function NavigationApp() {
  const [data, setData] = useState<WebstackCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<Language>("zh");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const stored = window.localStorage.getItem("dawnnav-language");
    if (stored === "en") setLanguage("en");
    fetch("/api/data", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "读取数据库失败");
        setData(body);
        setStatus("ready");
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "读取数据库失败");
        setStatus("error");
      });
  }, []);

  const totalLinks = useMemo(() => data.reduce((sum, category) => sum + countCategory(category), 0), [data]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return data.flatMap((category) => {
      if (activeCategory !== "all" && category.taxonomy !== activeCategory) return [];
      const next = { ...category };
      if (category.list) next.list = filterSections(category.list, normalizedQuery);
      else if (category.friend) next.friend = filterItems(category.friend, normalizedQuery);
      else next.links = filterItems(category.links ?? [], normalizedQuery);
      return countCategory(next) > 0 ? [next] : [];
    });
  }, [activeCategory, data, query]);

  const switchLanguage = () => {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
    window.localStorage.setItem("dawnnav-language", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="DawnNav 首页">
          <span className="brand-sun" aria-hidden="true"><i /></span>
          <span><b>DawnNav</b><small>黎明导航</small></span>
        </a>
        <nav className="topnav" aria-label={language === "zh" ? "主导航" : "Main navigation"}>
          <a href="#explore">{language === "zh" ? "探索" : "Explore"}</a>
          <a href="/admin">{language === "zh" ? "内容管理" : "Manage"}</a>
          <button type="button" className="language-button" onClick={switchLanguage}>{language === "zh" ? "EN" : "中文"}</button>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow"><span className={`live-dot ${status}`} /> {language === "zh" ? "由 SQL 数据库实时驱动" : "Live from the SQL database"}</p>
            <h1>{language === "zh" ? <>把值得抵达的地方，<em>留在黎明之前。</em></> : <>Keep the places worth reaching <em>before dawn.</em></>}</h1>
            <p className="hero-description">{language === "zh" ? "一个克制、双语、可搜索的知识入口。这里的每个分类与链接都来自动态数据库，并可在后台随时更新。" : "A focused, bilingual and searchable knowledge index. Every category and link is loaded live and can be updated from the dashboard."}</p>
          </div>
          <div className="hero-stats" aria-label={language === "zh" ? "数据库统计" : "Database statistics"}>
            <div><strong>{status === "ready" ? data.length : "—"}</strong><span>{language === "zh" ? "主题分类" : "Collections"}</span></div>
            <div><strong>{status === "ready" ? totalLinks : "—"}</strong><span>{language === "zh" ? "精选入口" : "Curated links"}</span></div>
            <div><strong>2</strong><span>{language === "zh" ? "界面语言" : "Languages"}</span></div>
          </div>
          <label className="hero-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">{language === "zh" ? "搜索全部站点" : "Search all sites"}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "zh" ? "搜索标题、简介或域名…" : "Search titles, notes or domains…"} />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label={language === "zh" ? "清空搜索" : "Clear search"}>×</button> : <kbd>/</kbd>}
          </label>
        </section>

        <section className="explorer" id="explore">
          <aside className="category-rail">
            <div className="rail-heading"><span>{language === "zh" ? "索引" : "Index"}</span><small>{String(data.length).padStart(2, "0")}</small></div>
            <button className={activeCategory === "all" ? "active" : ""} type="button" onClick={() => setActiveCategory("all")}>
              <span><i className="category-number">00</i>{language === "zh" ? "全部收录" : "All entries"}</span><b>{totalLinks}</b>
            </button>
            {data.map((category, index) => (
              <button className={activeCategory === category.taxonomy ? "active" : ""} type="button" key={category.taxonomy} onClick={() => setActiveCategory(category.taxonomy)}>
                <span><i className="category-number">{String(index + 1).padStart(2, "0")}</i>{text(category.taxonomy, category.taxonomy_en, language)}</span><b>{countCategory(category)}</b>
              </button>
            ))}
          </aside>

          <div className="catalog">
            <div className="catalog-heading">
              <div><p>{language === "zh" ? "动态目录" : "Live directory"}</p><h2>{query ? (language === "zh" ? `“${query}” 的搜索结果` : `Results for “${query}”`) : activeCategory === "all" ? (language === "zh" ? "全部收录" : "All collections") : text(data.find((item) => item.taxonomy === activeCategory)?.taxonomy, data.find((item) => item.taxonomy === activeCategory)?.taxonomy_en, language)}</h2></div>
              <span className="result-count">{visible.reduce((sum, category) => sum + countCategory(category), 0)} {language === "zh" ? "项" : "items"}</span>
            </div>

            {status === "loading" ? <div className="state-panel"><span className="loader" /><h3>{language === "zh" ? "正在连接数据库" : "Connecting to the database"}</h3></div> : null}
            {status === "error" ? <div className="state-panel error"><b>!</b><h3>{language === "zh" ? "暂时无法载入目录" : "The directory is unavailable"}</h3><p>{error}</p><button type="button" onClick={() => window.location.reload()}>{language === "zh" ? "重新加载" : "Reload"}</button></div> : null}
            {status === "ready" && visible.length === 0 ? <div className="state-panel"><b>0</b><h3>{language === "zh" ? "没有找到匹配内容" : "No matching entries"}</h3><p>{language === "zh" ? "试试更短的关键词，或切换到全部分类。" : "Try a shorter query or switch to all collections."}</p></div> : null}

            {visible.map((category, categoryIndex) => {
              const expanded = activeCategory !== "all" || Boolean(query);
              const directItems = category.friend ?? category.links ?? [];
              const sections = category.list ?? (directItems.length ? [{ term: category.taxonomy, term_en: category.taxonomy_en, links: directItems }] : []);
              return (
                <article className="collection" key={category.taxonomy}>
                  <header className="collection-header">
                    <span className={`collection-index tone-${categoryIndex % 6}`}>{String(data.findIndex((item) => item.taxonomy === category.taxonomy) + 1).padStart(2, "0")}</span>
                    <div><h3>{text(category.taxonomy, category.taxonomy_en, language)}</h3><p>{countCategory(category)} {language === "zh" ? "个站点" : "sites"}</p></div>
                    {!expanded && countCategory(category) > 12 ? <button type="button" onClick={() => setActiveCategory(category.taxonomy)}>{language === "zh" ? "查看全部" : "View all"} <span>→</span></button> : null}
                  </header>
                  {sections.map((section, sectionIndex) => {
                    const items = expanded ? section.links : section.links.slice(0, Math.max(0, 12 - sections.slice(0, sectionIndex).reduce((sum, item) => sum + item.links.slice(0, 12).length, 0)));
                    if (!items.length) return null;
                    const showSectionTitle = Boolean(category.list);
                    return <div className="collection-section" key={`${category.taxonomy}-${section.term}`}>
                      {showSectionTitle ? <h4><span>{text(section.term, section.term_en, language)}</span><small>{section.links.length}</small></h4> : null}
                      <div className="card-grid">{items.map((item, itemIndex) => <SiteCard key={`${item.url}-${itemIndex}`} item={item} language={language} index={categoryIndex + sectionIndex + itemIndex} />)}</div>
                    </div>;
                  })}
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#top"><span className="brand-sun" aria-hidden="true"><i /></span><span><b>DawnNav</b><small>{language === "zh" ? "寻找、整理、再次抵达。" : "Find, collect, return."}</small></span></a>
        <p>{language === "zh" ? "Next.js + Cloudflare D1 动态驱动" : "Dynamically powered by Next.js + Cloudflare D1"}</p>
        <a href="/admin">{language === "zh" ? "管理数据库 →" : "Manage database →"}</a>
      </footer>
    </div>
  );
}
