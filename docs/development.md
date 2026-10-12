# 开发、部署与资源预算

## 运行构建产物进行测试

```bash
./start-preview.sh
```

脚本使用 `shiro-dev` 和 `.env.development.local`，复用已存在的 CMS、数据库、文章和管理员账号。在主机按下面的批次串行构建，再制作运行镜像并启动网关和前端容器。源码不会热更新；改完源码重新执行脚本即可。

访问 `/login` 登录 CMS 管理员，访问 `/dashboard` 保存 GitHub 用户名或个人主页地址。绑定信息保存在 CMS 的站长资料中，`/projects` 自动分页同步公开仓库并与 CMS 项目按仓库 URL 去重。GitHub 限流、超时或服务故障时，使用最近一次成功同步的公开仓库，并在页面提示缓存状态；没有缓存时仍显示 CMS 项目并提示失败。快照保存在独立的 `github-cache` 数据卷中，容器更新后仍可复用。此处绑定公开项目来源，不涉及 GitHub OAuth 登录；公开仓库同步无需配置 Token。可选 `GH_TOKEN` 只在服务端用于公开用户和仓库列表请求，可写入本地环境文件；不会发送到浏览器，也不会用于任意仓库路径。

## 一键开发

安装 Node.js >=22.12、Corepack 和 Docker Compose，启动 Docker 后执行：

```bash
./start-dev.sh
```

脚本创建 `shiro-dev` Compose 项目，等待 PostgreSQL、Redis、CMS 迁移和健康检查，然后启动前端。CMS 使用与本地仓库一致的 `innei/mx-server:14.15.2`，提供 `/api/v3`；前端源码修改可热更新。CMS 服务端源码的改动需另行构建并更换 `MX_CMS_IMAGE`。

- 站点：`http://localhost:2323`
- 引导：`http://localhost:2323/setup`
- CMS 账号登录：`http://localhost:2323/login`
- CMS 后台：`http://localhost:2333/proxy/qaqdmin`

首次运行生成权限为 0600 的 `.env.development.local`，数据库密码、JWT 密钥和加密密钥随机生成。后续运行保持这些配置和 Docker 数据卷；配置文件不会提交或复制进 Docker 构建。

初始化先保存 SEO 和公开 URL，再创建 CMS 管理员，因为创建管理员会关闭 CMS 初始化接口。没有预设管理员或预设密码。前端使用 CMS 的 Better Auth 用户名登录与会话接口，登录信息和 CMS 后台共用。OAuth 访客登录仍可在 CMS 中配置。

CMS 和数据库会在 Ctrl+C 后继续运行。停止它们但保留数据：

```bash
docker compose --project-name shiro-dev --env-file .env.development.local -f compose.stack.yml stop
```

不要删除数据卷；重建服务会继续使用现有卷。更换数据库凭据时还需要在 PostgreSQL 内同步修改，修改环境文件不会改变已存在数据库中的密码。

## 内存与构建架构

所有常规开发、构建、类型检查和提交前 lint 通过 `scripts/run-next.mjs` 执行。开发和构建共用编译锁，拒绝第二个并行任务。检查类型、编译和 lint 各阶段串行运行。

| 模式            | 进程树预算 | V8 堆上限 |
| --------------- | ---------- | --------- |
| 开发            | 3072 MiB   | 512 MiB   |
| 生产构建        | 2048 MiB   | 1408 MiB  |
| 类型检查 / lint | 1536 MiB   | 768 MiB   |

Linux systemd 用户会话可用时，启动器通过 cgroup 限制整个任务的内存、禁止任务使用交换分区，并限制为最多两个 CPU 的份额。cgroup 使用量每 100 ms 检查一次，进程树 RSS 每秒采样一次。没有 systemd 的 Linux 使用进程树 RSS 监控，超出预算时终止该任务；这种采样方式可能出现短暂越限。设置 `SHIRO_REQUIRE_CGROUP=1` 会拒绝没有对应硬限制及 Swap 禁用的环境。Windows/macOS 使用 V8 堆限制和编译互斥，不提供 Linux 的 RSS/cgroup 限制。

构建分四批执行，各批使用独立进程，完成后释放内存：

1. 准备富文本样式、Shiki 语言语法与 Mermaid 浏览器资源。
2. 使用 Rolldown 单独预打包 Excalidraw 白板及其图表依赖。按锁文件和打包脚本生成指纹，依赖没有变化时复用本地结果；文章使用白板时加载本地浏览器模块，复用应用的 React 实例。
3. 单线程检查 TypeScript 类型。
4. 以低并行度 Webpack 整合 Next.js 路由和 standalone 产物。

Next.js 路由在最后一批统一生成；它们共享路由清单和服务端运行时，不能把多个独立 `.next` 输出直接拼接成同一个站点。大依赖提前分批处理，避免进入这一步的编译依赖图。之后 Docker 只复制成品。`pnpm vendors` 可单独执行资源预打包。

启动器监控整个 cgroup 的内存，包含原生分配和计入任务的文件缓存，并预留 128 MiB 停止余量。发生内核 OOM 时返回失败码，避免 Next CLI 的零退出码把失败误报为成功。

开发默认使用 Turbopack，生产默认使用 Webpack。开发支持热更新与 React Fast Refresh，启用开发磁盘缓存和缓存回收，开发代码不压缩以保留 Fast Refresh 状态；构建禁用 Webpack 缓存并使用一个页面生成 worker。代码检查插件已移除。首次部署的跳转在 proxy 阶段完成，进入引导页前无需编译整个博客首页。生产源码也在主机通过预算启动器串行构建。Dockerfile 只复制 standalone、静态文件和公开资源，容器启动时不安装前端依赖、不编译源码。

完整冷构建实测峰值为 1832 MiB，已配置 [GitHub Actions 2 GiB 构建与成品下载](build-memory.md)。保留 Next.js 的 SSR、路由及 CMS API 对接。若手动选择 Turbopack 生产构建，需同时提供其内存预算，例如 `SHIRO_BUNDLER=turbopack SHIRO_MEMORY_MB=3072 SHIRO_HEAP_MB=640 pnpm build`。

富文本使用 CMS 配套的 `@haklex/*` 0.46.4 独立静态模块与 Lexical 0.52，移除了会带入编辑器插件的整合包。富文本渲染槽、评论编辑器和代码高亮按需加载。富文本 CSS、Shiki 语言语法和 Mermaid 使用包提供的预编译浏览器资源，通过本地静态目录加载，保留全部 Shiki 语言支持，避免重复解析和压缩大型依赖。这些资源由启动器自动生成，不提交、不依赖公共 CDN。

TypeScript 使用微软推荐的[双版本安装方式](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0)：TypeScript 7.0.2 原生编译器以单线程检查代码，TypeScript 6 兼容 API 供 Next.js 和 ESLint 使用。Better Auth 与 CMS 保持 1.6.27；CMS 升级认证数据库 schema 后才适合一起升级到 1.7。其他直接依赖已按当前发布版本升级，pnpm 保留默认的包发布等待期。

```bash
pnpm build
pnpm --filter @shiro/web typecheck
pnpm --filter @shiro/web test
pnpm dev:stop
```

生产构建关闭服务端压缩和构建磁盘缓存以减少峰值，浏览器代码仍然压缩。服务器的冷启动和磁盘占用可能略有增加。Tailwind 只扫描前端源码和指定 UI 依赖，避免扫描生成的第三方资源。

每次运行的进程树 RSS、cgroup 峰值和结果保存在忽略提交的 `.runtime/last-run.json`，并分别保留在 `.runtime/build-result.json` 等按模式命名的文件中。如需调整预算，显式设置 `SHIRO_MEMORY_MB` 和 `SHIRO_HEAP_MB`，前者必须大于后者。

## 服务器部署

先生成服务器独立的密钥文件：

```bash
node scripts/prepare-stack.mjs production
```

编辑 `.env.production.local`，至少将公开 URL 和允许的来源改为你的域名，例如：

```dotenv
PUBLIC_WEB_URL=https://blog.example.com
ALLOWED_ORIGINS=blog.example.com
WEB_PORT=2323
```

保留生成的随机数据库密码、JWT 密钥和加密密钥，然后启动：

```bash
./start-production.sh
```

脚本先在主机串行构建前端，再把构建好的产物打包成运行镜像，最后启动 Compose 服务。Docker 中只运行成品，不执行 Next.js 构建；镜像打包兼容普通 Docker 构建器，不额外要求 Buildx。默认镜像名称为 `shiro:local`，可在环境文件中通过 `SHIRO_IMAGE` 修改。Docker 构建上下文只包含 standalone、静态文件和公开资源，不包含源码、开发缓存、密钥或截图。跨架构部署应在目标服务器上执行主机构建。

Nginx 在 2323 端口提供站点、`/api/v3`、CMS 后台和 Socket.IO。前端服务器通过内部 Docker 网络访问 CMS，浏览器使用同源 API；数据库和 Redis 不发布主机端口，CMS 主机端口默认仅监听 loopback。将域名的 HTTPS 反向代理指向服务器 2323 端口，并传递 Host 与 X-Forwarded-Proto。

首次访问域名仍会进入引导页，创建的管理员可直接登录 CMS 后台。`shiro-production` 与开发项目的数据卷相互独立，开发数据库中的账号和测试数据不会自动复制到生产环境。生产备份应包含 PostgreSQL、CMS 数据卷和 `.env.production.local`；恢复时需要原加密密钥。

容器也有资源限制：CMS 512 MiB，PostgreSQL 192 MiB，Redis 128 MiB，前端 512 MiB，网关 64 MiB。迁移容器只在启动迁移阶段运行，预算 512 MiB。可按服务器规模在 Compose 文件中调整。
