# Shiro

> [!IMPORTANT]
> **Shiro 已进入维护模式，将停留在当前版本，不再添加新功能，仅修复关键 Bug。**
>
> 如果你正在寻找一个全新的个人博客前端，请关注 **[余白 / Yohaku](https://github.com/Innei/Yohaku)** — 一个独立的新项目，拥有全新的设计语言与视觉体系。完整代码需 [赞助](https://github.com/sponsors/Innei) 获取访问权限。
>
> 此分支已适配 **MX-CMS Core 12+（API v3）**，使用 `@mx-space/api-client@5.13.0`；运行环境要求 Node.js 22+。

一个极简主义的个人网站主题，如纸的纯净，似雪的清新。

专为 [Mix Space](https://github.com/mx-space) 生态系统设计的现代化个人站点前端。

## :sparkles: 示例站点

以下是一些使用 Shiro 主题的精美站点：

- [静かな森](https://innei.in)
- [可愛い松](https://blog.wibus.ren/)

欢迎体验 Shiro 带来的极简之美！

## :rocket: 核心特性

- **:zap: 极致性能**：在 LightHouse 测试中表现卓越，Performance 和 Best Practice 均超过 90%
- **:art: 现代设计**：简洁而不简单的用户界面，提供流畅优雅的用户体验
- **:gem: 细节至上**：采用符合物理学的 Spring 弹性动画，每一帧都如自然般舒适
- **:bell: 实时通知**：通过 WebSocket 连接，访客可实时接收最新文章推送
- **:computer: 活动状态**：结合 [ProcessReporter](https://github.com/Innei/ProcessReporter)，在主页展示实时活动状态
- **:pencil: 扩展语法**：支持丰富的 Markdown 扩展语法，满足多样化写作需求
- **:house: 精美首页**：Hero 区域、活动流、时间线展示、风向标导航
- **:bulb: 思考系统**：独立的思考（Recently）页面，支持评论、点赞、RSS Feed
- **:clock3: 时间线**：按年份、类型筛选的文章/手记时间线
- **:globe_with_meridians: 多语言**：基于 next-intl 的国际化支持

## :gear: 技术架构

基于现代化的前端技术栈构建：

- **NextJS 16** (App Router) - React 全栈框架
- **Jotai** - 原子化状态管理
- **Motion** - 流畅动画库
- **Radix UI** - 无障碍组件库
- **Socket.IO** - 实时通信
- **TailwindCSS v4** - 原子化 CSS 框架
- **DaisyUI v5** - 组件库
- **TanStack Query** - 服务端状态管理

## MX-CMS API 配置

开发模式的 Core 路由不带版本前缀，`NEXT_PUBLIC_API_URL` 设置为 `http://localhost:2333`。
生产模式设置为 `https://你的域名/api/v3`；浏览器使用其他 API 地址时设置 `NEXT_PUBLIC_CLIENT_API_URL`。
`NEXT_PUBLIC_GATEWAY_URL` 指向 WebSocket 服务源地址，不包含 `/api/v3`。
可参考 [环境变量模板](apps/web/.env.template)。

Shiro 消费 CMS 的 `{ data, meta }` 响应，使用 `createdAt`、`modifiedAt`、`readCount`、`likeCount`
以及 `pagination.page/totalPages`。资源 ID 和评论游标始终保留为字符串。
文章翻译、点赞状态和链接 enrichment 从响应 meta 提取后进入页面缓存。
搜索使用 CMS 内置搜索，评论分别调用访客、读者和站长回复接口。

开发和生产构建默认使用 Turbopack，开发支持热更新和 React Fast Refresh。
富文本预编译 CSS、Shiki 语言资源和 Mermaid 浏览器模块直接作为静态资源提供，减少重复编译。
验证命令：`pnpm --filter @shiro/web test`、`pnpm --filter @shiro/web typecheck`
和 `pnpm --filter @shiro/web build:ci`。

## 📖 部署指南

详细的部署教程请参考：https://mx-space.js.org/docs/themes/shiro/deploy

感谢 @wibus-wee、@wuhang2003 等社区贡献者编写的详细文档。

## :camera: 界面预览

<img width="1471" alt="Live Demo" src="https://github.com/Innei/Shiro/assets/41265413/bf8af4ec-0f0c-441a-8c06-4b44e1649597">

<details>
<summary>
点击查看更多完整页面截图
</summary>

![页面截图 1](https://github.com/Innei/Shiro/assets/41265413/1b85c9be-0cd3-46b5-a089-a9ab97fdfecb)
![页面截图 2](https://github.com/Innei/Shiro/assets/41265413/d808d288-c022-42f2-8d74-ad057a588771)

</details>

## :zap: 性能测试

在 M2 MacBook Air 环境下对重负载页面的性能测试结果：

![性能测试结果](https://github.com/Innei/Shiro/assets/41265413/f76152af-4a52-46a2-9b83-20567800ba75)

## :whale: 快速开始

### :package: 预构建版本

从 [Releases](https://github.com/Innei/Shiro/releases) 页面下载最新的 `release.zip` 压缩包并解压：

```bash
cd standalone
vim .env # 配置环境变量
export PORT=2323
node server.js
```

### :docker: Docker Compose（推荐）

```bash
mkdir shiro && cd shiro
wget https://raw.githubusercontent.com/Innei/Shiro/main/docker-compose.yml
wget https://raw.githubusercontent.com/Innei/Shiro/main/.env.template .env

vim .env     # 配置环境变量
mkdir public # 放置自定义 Favicon
docker compose up -d

# 后续更新
docker compose pull
```

## :memo: Markdown 扩展

了解更多 Markdown 扩展语法，请访问：https://shiro.innei.in/#/markdown

## 本仓库的开发和服务器部署

开发环境使用 Docker PostgreSQL、Redis 和 MX-CMS 14.15.2，前端使用 Next.js 开发服务器：

```bash
./start-dev.sh
```

打开 http://localhost:2323。首次访问进入引导页，填写站点信息并创建 CMS 管理员。之后可在 `/login` 使用同一账号登录，进入站点或 CMS 后台。

开发与构建进程树默认预算均为 3072 MiB；构建和开发互斥，避免重复编译占满内存。Linux 可用 systemd 用户会话时同时设置 cgroup 硬限制；其他 Linux 环境监控整个编译进程树的 RSS。超出预算会停止本次编译。数据库、CMS 和站点资源均使用独立的 Docker 数据卷；再次启动会复用，Ctrl+C 只停止前端。停止前端也可执行 `pnpm dev:stop`。

服务器部署、域名配置、数据卷和内存参数详见 [开发与部署说明](docs/development.md)。

## :star: 余白 / Yohaku

**[余白 / Yohaku](https://github.com/Innei/Yohaku)** 是一个全新的个人博客项目，拥有独立的设计语言与视觉体系。如果你希望获得持续更新的体验，推荐关注 Yohaku。

[![Sponsor](https://img.shields.io/badge/Sponsor-Innei-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/Innei)

## :star: 白い (Shiroi) - 赞助版

[白い](https://github.com/innei-dev/Shiroi) 是 Shiro 的付费赞助版本，包含更多高级功能：

### :robot: AI 智能功能

- AI 智能摘要生成
- AI 内容翻译系统（支持实时翻译推送）
- AI 生成标记系统（支持标记翻译、摘要、自动生成等内容来源）

### :sparkles: 高级视觉效果

- WebGPU 雪花背景效果（高级粒子物理系统）
- 萤火虫粒子效果
- 纹理背景系统
- 页面渐变色背景
- 噪声背景生成

### :busts_in_silhouette: 实时协作

- Socket.IO 房间管理
- 在线用户实时展示（Presence 组件）
- 访客信息追踪

### :lock: 认证系统

- Passkey 无密码认证支持
- Passkey 管理页面（创建、列表）

### :speech_balloon: 评论系统增强

- Lexical 富文本评论编辑器
- 评论内联编辑功能
- 评论操作按钮组（编辑/回复）

### :bar_chart: 后台系统

- 完整的仪表盘界面
- Lexical 富文本编辑器
- 文章/笔记编辑器增强
- 每日诗词展示（今日诗词 API）

### :chart_with_upwards_trend: 分析集成

- OpenPanel 用户行为分析
- 屏幕视图追踪
- 外链点击追踪

## :heart: 致谢与许可

**© 2026 Innei** - 本项目采用 AGPLv3 许可证，并附加特定的商业使用条件。

使用本项目需要遵循 [附加条款和条件](ADDITIONAL_TERMS.md)。

---

> [个人网站](https://innei.in/) · GitHub [@Innei](https://github.com/innei/)
