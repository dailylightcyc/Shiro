# 2 GiB 生产构建验证

2026-10-12 在 Linux cgroup v2、Node.js 22.22.3、Next.js 16.4.0 下实测。上限针对整个编译任务及其子进程，包含原生内存和计入任务的文件缓存；不代表整台电脑或 CMS、数据库、浏览器的合计内存。

| 方案                                                | cgroup 总峰值 | 结果                            |
| --------------------------------------------------- | ------------: | ------------------------------- |
| 之前的 Turbopack，3072 MiB 上限                     |      2842 MiB | 完整构建成功                    |
| Turbopack，2048 MiB 上限、640 MiB 堆                |      2034 MiB | 预算监控终止，未完成            |
| Webpack，2048 MiB 上限、1408 MiB 堆，复用预打包资源 |      1819 MiB | 完整构建成功，无 OOM            |
| 同一 Webpack 方案，清除所有前端生成缓存             |      1832 MiB | 完整构建成功，无 OOM，约 143 秒 |

失败构建不算通过。早期 Webpack 测试还遇到 V8 堆不足、CMS 富文本的 ESM 导出解析及浏览器引入 Node webhook 实现的问题，均已调整。生产构建禁用 Webpack 缓存并降低并行度；CMS 富文本按需入口显式解析 ESM 导出；浏览器评论事件仅使用 CMS 类型定义和协议名称，签名校验仍在服务端执行。

冷构建删除了 `.next`、TypeScript 增量缓存、`public/vendor` 和 `src/lib/generated`，实际重新打包白板、检查类型、编译全部路由并生成 standalone。未清理操作系统文件缓存，也未重装依赖。批次峰值为每 100 ms 采样的 cgroup 使用量，RSS 每秒采样；全流程峰值读取内核 `memory.peak`，不能用采样 RSS 代替它。

| 冷构建批次                               |     时长 | 采样 cgroup 峰值 |
| ---------------------------------------- | -------: | ---------------: |
| 样式、语法、图表资源                     |   0.1 秒 |           11 MiB |
| Rolldown 预打包白板                      |   1.2 秒 |          779 MiB |
| 单线程类型检查                           |   5.9 秒 |          924 MiB |
| Next.js Webpack 编译、页面生成、文件追踪 | 136.1 秒 |         1829 MiB |

## 本地复现

默认 `pnpm build` 已使用 Webpack、2048 MiB 总预算、1408 MiB V8 堆，开发模式仍可用 Turbopack。Linux systemd 用户会话可用时自动创建 cgroup；添加下面的参数会拒绝没有硬上限或未关闭 Swap 的环境：

```bash
SHIRO_REQUIRE_CGROUP=1 pnpm build
cat .runtime/build-result.json
```

冷构建前仅删除可生成目录：

```bash
rm -rf apps/web/.next apps/web/tsconfig.tsbuildinfo \
  apps/web/public/vendor apps/web/src/lib/generated
SHIRO_REQUIRE_CGROUP=1 pnpm build
```

成功报告需要 `code: 0`、`enforcement: "cgroup"`、`budgetMiB: 2048`，四批全部成功、`oomKilled: false`，并且完整 standalone 和路由清单存在。报告保存在 `.runtime/build-result.json`，详细日志可重定向到 `.runtime`。字体冷构建仍需访问 Google Fonts；依赖安装需访问包仓库。

## GitHub Actions

[build.yml](../.github/workflows/build.yml) 在 main 推送、PR 或手动运行时执行。使用 Ubuntu 24.04、相同 Node 和 pnpm 版本，冻结锁文件安装，单 worker 测试。编译以 runner 用户在独立 systemd cgroup 中运行，`MemoryMax=2048M`、`MemorySwapMax=0`；应用再次检查实际限额，缺少硬限制就失败。不会恢复 Next.js 或第三方生成缓存。

构建失败时上传日志和已生成的内存报告；成功时另外上传 `shiro-standalone.tar.gz` 及 SHA-256。打包程序检查完整路由、构建标记和内存报告，排除环境密钥文件。每次 GitHub 运行仍需独立通过限额验证；本地数据不保证不同系统、架构或后续依赖升级具有相同峰值。

成品包含现有 Dockerfile、Docker 构建上下文规则、standalone、公开资源和静态文件。下载并解压到部署仓库后，可执行：

```bash
sha256sum -c shiro-standalone.tar.gz.sha256
tar -xzf shiro-standalone.tar.gz
docker build -t shiro:local .
docker compose --project-name shiro-production --env-file .env.production.local \
  -f compose.stack.yml --profile production up -d --no-build --wait
```

先按 [部署文档](development.md#服务器部署) 生成服务器自己的 `.env.production.local` 并填写域名。Docker 只复制成品，不编译前端源码。产物面向 Linux x64；其他架构需在对应架构构建。原包分析工作流改为手动运行，原作者跨仓库部署触发器仅在其原仓库运行，避免 main 推送重复构建或触发其他人的部署。
