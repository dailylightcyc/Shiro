import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import NextBundleAnalyzer from '@next/bundle-analyzer'
import { config } from 'dotenv'
import createNextIntlPlugin from 'next-intl/plugin'

const svgPattern = /\.svg$/i

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

process.title = 'Shiro (NextJS)'

const env = config().parsed || {}
const isProd = process.env.NODE_ENV === 'production'

let commitHash = ''
let commitUrl = ''
const repoInfo = getRepoInfo()

if (repoInfo) {
  commitHash = repoInfo.hash
  commitUrl = repoInfo.url
}

/** @type {import('next').NextConfig} */

let nextConfig = {
  env: {
    COMMIT_HASH: commitHash,
    COMMIT_URL: commitUrl,
    BUILD_TIME: new Date().toISOString(),
  },

  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    resolveAlias: {
      mermaid: './src/lib/mermaid-vendor.ts',
      '@excalidraw/excalidraw': './src/lib/excalidraw-vendor.ts',
      '@excalidraw/excalidraw/index.css':
        './src/lib/excalidraw-style-vendor.ts',
      'shiki/bundle/full': './src/lib/shiki-bundle.ts',
      'shiki/bundle/web': './src/lib/shiki-bundle.ts',
    },
  },
  onDemandEntries: { maxInactiveAge: 15000, pagesBufferLength: 1 },
  productionBrowserSourceMaps: false,
  output: 'standalone',
  assetPrefix: isProd ? env.ASSETPREFIX || undefined : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  compiler: {
    // reactRemoveProperties: { properties: ['^data-id$', '^data-(\\w+)-id$'] },
  },
  experimental: {
    serverMinification: false,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    cpus: 1,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    serverSourceMaps: false,
    preloadEntriesOnStart: false,
    turbopackMemoryEviction: 'full',
    turbopackGc: { rootTtlMs: 60000 },
    turbopackFileSystemCacheForBuild: false,
    turbopackMinify: isProd ? { server: false, client: true } : false,
    globalNotFound: true,

    // optimizePackageImports: ['dayjs'],
  },
  images: {
    unoptimized:
      // Squoosh has memory leak issue, but it will remove in next.js 14.3.0
      // !process.env.VERCEL && isProd && eval('!process.env.NEXT_SHARP_PATH'),
      process.env.NODE_ENV !== 'production',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox; style-src 'unsafe-inline';",
  },

  async redirects() {
    return [
      {
        source: '/notes/topics',
        destination: '/notes/series',
        permanent: true,
      },
      {
        source: '/notes/topics/:slug',
        destination: '/notes/series/:slug',
        permanent: true,
      },
      {
        source: '/:locale/notes/topics',
        destination: '/:locale/notes/series',
        permanent: true,
      },
      {
        source: '/:locale/notes/topics/:slug',
        destination: '/:locale/notes/series/:slug',
        permanent: true,
      },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/atom.xml', destination: '/feed' },
        { source: '/feed.xml', destination: '/feed' },
        { source: '/sitemap.xml', destination: '/sitemap' },
      ],
    }
  },
  webpack: (config, { dev }) => {
    const shikiBundle = fileURLToPath(
      new URL('./src/lib/shiki-bundle.ts', import.meta.url),
    )
    config.resolve.alias['shiki/bundle/full'] = shikiBundle
    config.resolve.alias['shiki/bundle/web'] = shikiBundle
    config.resolve.alias.mermaid = fileURLToPath(
      new URL('./src/lib/mermaid-vendor.ts', import.meta.url),
    )
    config.resolve.alias['@excalidraw/excalidraw$'] = fileURLToPath(
      new URL('./src/lib/excalidraw-vendor.ts', import.meta.url),
    )
    config.resolve.alias['@excalidraw/excalidraw/index.css$'] = fileURLToPath(
      new URL('./src/lib/excalidraw-style-vendor.ts', import.meta.url),
    )
    // next/dynamic also resolves the import for SSR; this ESM-only package has
    // no require export. Resolve its published entry without changing subpaths.
    for (const specifier of [
      '@haklex/rich-editor-ui',
      '@haklex/rich-editor/renderers',
      '@haklex/rich-renderer-alert/static',
      '@haklex/rich-renderer-banner/static',
      '@haklex/rich-renderer-codeblock/static',
      '@haklex/rich-renderer-image/static',
      '@haklex/rich-renderer-mention/static',
      '@haklex/rich-renderer-mermaid/static',
      '@haklex/rich-renderer-video/static',
      '@haklex/rich-ext-chat/renderer',
      '@haklex/rich-ext-code-snippet/renderer',
      '@haklex/rich-ext-gallery/renderer',
    ]) {
      config.resolve.alias[`${specifier}$`] = fileURLToPath(
        import.meta.resolve(specifier),
      )
    }
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    })

    config.parallelism = 1
    // Node 22+ and Next.js-supported browsers can run the async vendor loaders.
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    }
    if (!dev) {
      config.cache = false
    } else if (config.cache && typeof config.cache === 'object') {
      config.cache.maxMemoryGenerations = 1
    }

    config.module.rules.push({
      test: svgPattern,
      type: 'asset/source',
    })

    return config
  },
}

// if (env.SENTRY === 'true' && isProd) {
//   // @ts-expect-error
//   nextConfig = withSentryConfig(
//     nextConfig,
//     {
//       // For all available options, see:
//       // https://github.com/getsentry/sentry-webpack-plugin#options
//
//       // Suppresses source map uploading logs during build
//       silent: true,
//
//       org: 'inneis-site',
//       project: 'Shiro',
//     },
//     {
//       // For all available options, see:
//       // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
//
//       // Upload a larger set of source maps for prettier stack traces (increases build time)
//       widenClientFileUpload: true,
//
//       // Transpiles SDK to be compatible with IE11 (increases bundle size)
//       transpileClientSDK: true,
//
//       // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
//       tunnelRoute: '/monitoring',
//
//       // Hides source maps from generated client bundles
//       hideSourceMaps: true,
//
//       // Automatically tree-shake Sentry logger statements to reduce bundle size
//       disableLogger: true,
//     },
//   )
// }

if (process.env.ANALYZE === 'true') {
  nextConfig = NextBundleAnalyzer({
    enabled: true,
  })(nextConfig)
}

export default withNextIntl(nextConfig)

function getRepoInfo() {
  if (process.env.VERCEL) {
    const { VERCEL_GIT_PROVIDER, VERCEL_GIT_REPO_SLUG, VERCEL_GIT_REPO_OWNER } =
      process.env

    switch (VERCEL_GIT_PROVIDER) {
      case 'github': {
        return {
          hash: process.env.VERCEL_GIT_COMMIT_SHA,
          url: `https://github.com/${VERCEL_GIT_REPO_OWNER}/${VERCEL_GIT_REPO_SLUG}/commit/${process.env.VERCEL_GIT_COMMIT_SHA}`,
        }
      }
    }
  } else {
    return getRepoInfoFromGit()
  }
}

function getRepoInfoFromGit() {
  try {
    // 获取最新的 commit hash
    // 获取当前分支名称
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim()
    // 获取当前分支跟踪的远程仓库名称
    const remoteName = execSync(`git config branch.${currentBranch}.remote`)
      .toString()
      .trim()
    // 获取当前分支跟踪的远程仓库的 URL
    let remoteUrl = execSync(`git remote get-url ${remoteName}`)
      .toString()
      .trim()

    // 获取最新的 commit hash
    const hash = execSync('git rev-parse HEAD').toString().trim()
    // 转换 git@ 格式的 URL 为 https:// 格式
    if (remoteUrl.startsWith('git@')) {
      remoteUrl = remoteUrl
        .replace(':', '/')
        .replace('git@', 'https://')
        .replace('.git', '')
    } else if (remoteUrl.endsWith('.git')) {
      // 对于以 .git 结尾的 https URL，移除 .git
      remoteUrl = remoteUrl.slice(0, -4)
    }

    // 根据不同的 Git 托管服务自定义 URL 生成规则
    let webUrl
    if (remoteUrl.includes('github.com')) {
      webUrl = `${remoteUrl}/commit/${hash}`
    } else if (remoteUrl.includes('gitlab.com')) {
      webUrl = `${remoteUrl}/-/commit/${hash}`
    } else if (remoteUrl.includes('bitbucket.org')) {
      webUrl = `${remoteUrl}/commits/${hash}`
    } else {
      // 对于未知的托管服务，可以返回 null 或一个默认格式
      webUrl = `${remoteUrl}/commits/${hash}`
    }

    return { hash, url: webUrl }
  } catch (error) {
    console.error('Error fetching repo info:', error?.stderr?.toString())
    return null
  }
}
