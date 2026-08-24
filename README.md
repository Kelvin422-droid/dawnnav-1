# 黎明导航

## 动态数据库版本

当前项目支持两种运行方式：直接使用 Hugo 构建静态备用页面，或通过 Node.js + SQLite/D1 运行动态网站。动态模式下，首页每次请求都会读取 SQL，管理页保存后不需要重新构建。

本地启动：

```powershell
node scripts/import-webstack.js
node server.js
```

然后访问：

- 首页：`http://127.0.0.1:3000/`
- 数据库管理：`http://127.0.0.1:3000/admin.html`
- 健康检查：`http://127.0.0.1:3000/api/health`

公开部署管理页前，请设置 `ADMIN_TOKEN`。数据库文件默认位于 `storage/webstack.db`，首次启动时会自动从 `data/webstack.yml` 导入初始数据。

**基于 Hugo-Webstack 网址导航网站**

fork from https://github.com/oulh/nav/

可以自己 fork 部署以及 pull request

这里介绍 Github Pages 的方法：

1. 导入或 Fork 本项目 

2. Github Pages 设置

   ![](https://raw.githubusercontent.com/oulh/nav/main/static/images/gh-pages.jpg)

3. Github Action 设置
   
   如果是导入的：Settings - Actions - General - Allow all actions and reusable workflows
   
   如果是Fork的：Actions - "I understand my workflows, go ahead and enable them"

4. 可自定义编辑的内容：
   
   - 主页面：/data/webstack.yml
   - 子页面：/content/xxx.md
   
   查看构建状态：Actions - All workflows
   
   如何希望提交后不触发构建，只需在 commit 信息中包含关键词：`[skip ci]`或`[no ci]`，包括[]符号。
   
5. 访问页面

   你的站点链接是：https://用户名.github.io/仓库名
   
6. pull request

## Cloudflare Pages 部署

这个仓库可以直接作为 Cloudflare Pages 的 Hugo 静态站点来源。推荐设置如下：

- Build command: `hugo --gc --minify`
- Build output directory: `public`
- Environment variable: 如需自定义域名，请把 `hugo.toml` 里的 `baseURL` 改成对应站点地址

## 附：webstack.yml

可以复制以下配置，编辑 [webstack.yml](https://github.com/oulh/nav/blob/main/data/webstack.yml) 原有的内容，修改完可以问 gpt 你改的对不对。

title和url是必要属性，其他非必须。

```yaml
---
- taxonomy: 分类名称
  icon: fa-star
  links: 
    - title: 
      url: https://
      logo: 
      description: 
    - title: 
      url: 
      description: 
    - title: 
      url: 

          
- taxonomy: 
  icon: 
  list: 
    - term: 
      links:
        - title: 
          url: 
          description: 
    - term: 
      links:
        - title: 
          url: 
        - title: 
          url: 

- taxonomy: 其他链接
  icon: fa-link
  friend:
    - title: 
      url: 
      description: 
    - title: 
      url: 
      
---
```
