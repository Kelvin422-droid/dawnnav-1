"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryMode, LinkItem, LinkSection, WebstackCategory } from "@/lib/webstack";

function modeOf(category: WebstackCategory): CategoryMode {
  if (Array.isArray(category.list)) return "list";
  if (Array.isArray(category.friend)) return "friend";
  return "links";
}

function categoryCount(category: WebstackCategory) {
  return (category.links?.length ?? category.friend?.length ?? 0) + (category.list?.reduce((sum, section) => sum + section.links.length, 0) ?? 0);
}

const emptyLink = (): LinkItem => ({ title: "新站点", title_en: "New site", url: "https://", description: "", description_en: "" });

function LinkEditor({ link, index, onChange, onRemove }: { link: LinkItem; index: number; onChange: (next: LinkItem) => void; onRemove: () => void }) {
  const set = (field: keyof LinkItem, value: string) => onChange({ ...link, [field]: value });
  return (
    <details className="link-editor" open={index === 0}>
      <summary><span className="link-order">{String(index + 1).padStart(2, "0")}</span><strong>{link.title || "未命名站点"}</strong><small>{link.url}</small><span className="details-hint">编辑</span></summary>
      <div className="link-fields">
        <label><span>中文名称 *</span><input value={link.title} onChange={(event) => set("title", event.target.value)} /></label>
        <label><span>英文名称</span><input value={link.title_en ?? ""} onChange={(event) => set("title_en", event.target.value)} /></label>
        <label className="wide"><span>网址 *</span><input type="url" value={link.url} onChange={(event) => set("url", event.target.value)} /></label>
        <label><span>中文简介</span><textarea rows={3} value={link.description ?? ""} onChange={(event) => set("description", event.target.value)} /></label>
        <label><span>英文简介</span><textarea rows={3} value={link.description_en ?? ""} onChange={(event) => set("description_en", event.target.value)} /></label>
        <label><span>Logo 路径</span><input value={link.logo ?? ""} onChange={(event) => set("logo", event.target.value)} placeholder="/images/logos/example.png" /></label>
        <label><span>二维码路径</span><input value={link.qrcode ?? ""} onChange={(event) => set("qrcode", event.target.value)} /></label>
      </div>
      <button className="danger-link" type="button" onClick={onRemove}>删除这个站点</button>
    </details>
  );
}

export function AdminApp() {
  const [data, setData] = useState<WebstackCategory[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const category = data[selected];
  const total = useMemo(() => data.reduce((sum, item) => sum + categoryCount(item), 0), [data]);

  useEffect(() => {
    fetch("/api/data", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "读取失败");
        setData(body);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "读取失败"))
      .finally(() => setLoading(false));
  }, []);

  const updateCategory = (next: WebstackCategory) => setData((current) => current.map((item, index) => index === selected ? next : item));
  const patchCategory = (field: keyof WebstackCategory, value: unknown) => category && updateCategory({ ...category, [field]: value });

  const changeMode = (mode: CategoryMode) => {
    if (!category || modeOf(category) === mode) return;
    const next: WebstackCategory = { taxonomy: category.taxonomy, taxonomy_en: category.taxonomy_en, icon: category.icon };
    if (mode === "list") next.list = [{ term: "新分组", term_en: "New section", links: [] }];
    else if (mode === "friend") next.friend = [];
    else next.links = [];
    updateCategory(next);
  };

  const addCategory = () => {
    const next: WebstackCategory = { taxonomy: "新分类", taxonomy_en: "New collection", icon: "fa-star", links: [] };
    setData((current) => [...current, next]);
    setSelected(data.length);
  };

  const removeCategory = () => {
    setData((current) => current.filter((_, index) => index !== selected));
    setSelected((current) => Math.max(0, current - 1));
  };

  const updateDirectLinks = (links: LinkItem[]) => {
    if (!category) return;
    if (modeOf(category) === "friend") updateCategory({ ...category, friend: links });
    else updateCategory({ ...category, links });
  };

  const updateSections = (sections: LinkSection[]) => category && updateCategory({ ...category, list: sections });

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ data })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      setMessage(`已写入数据库：${body.categories} 个分类，${body.links} 个站点。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <a className="brand" href="/"><span className="brand-sun" aria-hidden="true"><i /></span><span><b>DawnNav</b><small>内容工作台</small></span></a>
        <div className="admin-actions"><a href="/">预览网站 ↗</a><button className="primary-button" type="button" onClick={save} disabled={loading || saving}>{saving ? "正在写入…" : "保存到 SQL"}</button></div>
      </header>

      <main className="admin-main">
        <aside className="admin-sidebar">
          <div className="admin-summary"><p>数据库概览</p><strong>{data.length}</strong><span>个分类 · {total} 个站点</span></div>
          <div className="admin-list-heading"><span>内容分类</span><button type="button" onClick={addCategory}>＋ 新建</button></div>
          <div className="admin-category-list">
            {data.map((item, index) => <button className={index === selected ? "active" : ""} key={`${item.taxonomy}-${index}`} type="button" onClick={() => setSelected(index)}><span><i>{String(index + 1).padStart(2, "0")}</i>{item.taxonomy || "未命名分类"}</span><b>{categoryCount(item)}</b></button>)}
          </div>
          <label className="token-field"><span>管理令牌（如已设置）</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="current-password" /></label>
        </aside>

        <section className="admin-content">
          {message ? <div className="admin-message" role="status">{message}<button type="button" onClick={() => setMessage("")}>×</button></div> : null}
          {loading ? <div className="state-panel"><span className="loader" /><h3>正在读取 SQL 数据库</h3></div> : null}
          {!loading && category ? <>
            <div className="editor-heading"><div><p>分类 {String(selected + 1).padStart(2, "0")}</p><h1>{category.taxonomy || "未命名分类"}</h1><span>修改会先保存在当前页面，点击右上角按钮后才写入数据库。</span></div><button className="danger-button" type="button" onClick={removeCategory}>删除分类</button></div>
            <section className="settings-panel">
              <div className="panel-title"><span>01</span><div><h2>分类设置</h2><p>定义前台导航中显示的双语名称和内容结构。</p></div></div>
              <div className="settings-grid">
                <label><span>中文分类名 *</span><input value={category.taxonomy} onChange={(event) => patchCategory("taxonomy", event.target.value)} /></label>
                <label><span>英文分类名</span><input value={category.taxonomy_en ?? ""} onChange={(event) => patchCategory("taxonomy_en", event.target.value)} /></label>
                <label><span>图标标识</span><input value={category.icon ?? ""} onChange={(event) => patchCategory("icon", event.target.value)} /></label>
                <label><span>内容结构</span><select value={modeOf(category)} onChange={(event) => changeMode(event.target.value as CategoryMode)}><option value="links">普通链接</option><option value="list">多级分组</option><option value="friend">友情链接</option></select></label>
              </div>
            </section>

            <section className="settings-panel">
              <div className="panel-title"><span>02</span><div><h2>站点内容</h2><p>当前分类共 {categoryCount(category)} 个站点；展开卡片即可编辑字段。</p></div></div>
              {category.list ? <div className="section-editors">
                {category.list.map((section, sectionIndex) => <div className="section-editor" key={`${section.term}-${sectionIndex}`}>
                  <div className="section-editor-heading"><div><label><span>分组中文名</span><input value={section.term} onChange={(event) => updateSections(category.list!.map((item, index) => index === sectionIndex ? { ...item, term: event.target.value } : item))} /></label><label><span>分组英文名</span><input value={section.term_en ?? ""} onChange={(event) => updateSections(category.list!.map((item, index) => index === sectionIndex ? { ...item, term_en: event.target.value } : item))} /></label></div><button type="button" onClick={() => updateSections(category.list!.filter((_, index) => index !== sectionIndex))}>删除分组</button></div>
                  <div className="link-editor-list">{section.links.map((link, linkIndex) => <LinkEditor key={`${link.url}-${linkIndex}`} link={link} index={linkIndex} onChange={(next) => updateSections(category.list!.map((item, index) => index === sectionIndex ? { ...item, links: item.links.map((current, currentIndex) => currentIndex === linkIndex ? next : current) } : item))} onRemove={() => updateSections(category.list!.map((item, index) => index === sectionIndex ? { ...item, links: item.links.filter((_, currentIndex) => currentIndex !== linkIndex) } : item))} />)}</div>
                  <button className="add-row-button" type="button" onClick={() => updateSections(category.list!.map((item, index) => index === sectionIndex ? { ...item, links: [...item.links, emptyLink()] } : item))}>＋ 添加站点到此分组</button>
                </div>)}
                <button className="add-section-button" type="button" onClick={() => updateSections([...category.list!, { term: "新分组", term_en: "New section", links: [] }])}>＋ 新建分组</button>
              </div> : <>
                <div className="link-editor-list">{(category.friend ?? category.links ?? []).map((link, index, links) => <LinkEditor key={`${link.url}-${index}`} link={link} index={index} onChange={(next) => updateDirectLinks(links.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => updateDirectLinks(links.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
                <button className="add-row-button" type="button" onClick={() => updateDirectLinks([...(category.friend ?? category.links ?? []), emptyLink()])}>＋ 添加一个站点</button>
              </>}
            </section>
          </> : null}
        </section>
      </main>
    </div>
  );
}
