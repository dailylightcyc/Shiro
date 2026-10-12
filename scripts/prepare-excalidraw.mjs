import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const web = resolve(root, 'apps/web')
const require = createRequire(resolve(web, 'package.json'))
const { rolldown } = await import(require.resolve('rolldown'))
const entry = require.resolve('@excalidraw/excalidraw')
const distribution = dirname(entry)
// Rebuild only when the lockfile or this bundling recipe changes.
const fingerprint = createHash('sha256')
  .update(readFileSync(resolve(root, 'pnpm-lock.yaml')))
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .digest('hex')
  .slice(0, 16)
const output = resolve(web, 'public/vendor/excalidraw', fingerprint)
const marker = resolve(output, '.complete')
if (!existsSync(marker)) {
  console.log('Batch 2: prebundle the whiteboard separately from Next.js.')
  mkdirSync(output, { recursive: true })
  const runtimes = {}
  for (const name of ['react', 'react-dom', 'react/jsx-runtime']) {
    runtimes[name] = await import(require.resolve(name))
  }
  const bundle = await rolldown({
    input: entry,
    platform: 'browser',
    resolve: { conditionNames: ['production', 'browser', 'import', 'default'] },
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
    plugins: [
      {
        name: 'share-application-react',
        resolveId(source) {
          if (Object.hasOwn(runtimes, source)) return `\0shiro:${source}`
        },
        load(id) {
          if (!id.startsWith('\0shiro:')) return
          const name = id.slice('\0shiro:'.length)
          const keys = Object.keys(runtimes[name]).filter(
            (key) => key !== 'default' && /^[a-z_$][\w$]*$/i.test(key),
          )
          return [
            `const runtime = globalThis.__SHIRO_VENDOR_REACT__[${JSON.stringify(name)}];`,
            'export default runtime.default ?? runtime;',
            ...keys.map((key) => `export const ${key} = runtime.${key};`),
          ].join('\n')
        },
      },
    ],
    onwarn(warning, warn) {
      if (
        !['CIRCULAR_DEPENDENCY', 'MODULE_LEVEL_DIRECTIVE'].includes(
          warning.code,
        )
      ) {
        warn(warning)
      }
    },
  })
  try {
    await bundle.write({
      dir: output,
      format: 'esm',
      entryFileNames: 'index.mjs',
      chunkFileNames: 'chunks/[name]-[hash].mjs',
      minify: true,
      sourcemap: false,
    })
  } finally {
    await bundle.close()
  }
  cpSync(resolve(distribution, 'index.css'), resolve(output, 'index.css'))
  cpSync(resolve(distribution, 'fonts'), resolve(output, 'fonts'), {
    recursive: true,
  })
  writeFileSync(marker, fingerprint)
} else {
  console.log('Batch 2: reuse the prepared whiteboard bundle.')
}
const generated = resolve(web, 'src/lib/generated')
mkdirSync(generated, { recursive: true })
writeFileSync(
  resolve(generated, 'excalidraw-version.json'),
  JSON.stringify({ fingerprint }),
)
