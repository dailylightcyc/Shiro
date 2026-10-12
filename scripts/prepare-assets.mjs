import {
  cpSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(resolve(root, 'apps/web/package.json'))
const shikiRequire = createRequire(require.resolve('shiki/package.json'))
const styles = [
  '@haklex/rich-editor',
  '@haklex/rich-editor-ui',
  '@haklex/rich-renderer-alert',
  '@haklex/rich-renderer-banner',
  '@haklex/rich-renderer-codeblock',
  '@haklex/rich-renderer-image',
  '@haklex/rich-renderer-katex',
  '@haklex/rich-renderer-linkcard',
  '@haklex/rich-renderer-mention',
  '@haklex/rich-renderer-mermaid',
  '@haklex/rich-renderer-video',
  '@haklex/rich-ext-chat',
  '@haklex/rich-ext-code-snippet',
  '@haklex/rich-ext-embed',
  '@haklex/rich-ext-excalidraw',
  '@haklex/rich-ext-gallery',
  '@haklex/rich-ext-nested-doc',
  '@haklex/rich-ext-poll',
]
const output = resolve(root, 'apps/web/public/vendor')
mkdirSync(output, { recursive: true })
const css = styles.map(
  (name) =>
    `/* ${name}: precompiled vendor styles, MIT license */\n${readFileSync(require.resolve(`${name}/style.css`), 'utf8')}`,
)
const katexCss = require.resolve('katex/dist/katex.min.css')
css.push(readFileSync(katexCss, 'utf8'))
cpSync(resolve(dirname(katexCss), 'fonts'), resolve(output, 'fonts'), {
  recursive: true,
})
writeFileSync(resolve(output, 'rich-content.css'), css.join('\n'))

// Serve the published browser ESM grammars unchanged. Next does not need to
// parse and minify hundreds of large regular-expression tables on every build.
const { version } = JSON.parse(
  readFileSync(require.resolve('shiki/package.json'), 'utf8'),
)
const { bundledLanguagesInfo } = await import(
  require.resolve('shiki/bundle/full')
)
cpSync(
  dirname(shikiRequire.resolve('@shikijs/langs/javascript')),
  resolve(output, 'shiki', version, 'langs'),
  { recursive: true },
)
const generated = resolve(root, 'apps/web/src/lib/generated')
mkdirSync(generated, { recursive: true })
writeFileSync(
  resolve(generated, 'shiki-languages.json'),
  JSON.stringify({
    version,
    languages: bundledLanguagesInfo.map(({ id, name, aliases }) => ({
      id,
      name,
      aliases,
    })),
  }),
)

const mermaidEntry = require.resolve('mermaid')
const mermaidRoot = resolve(dirname(mermaidEntry), '..')
const mermaidVersion = JSON.parse(
  readFileSync(resolve(mermaidRoot, 'package.json'), 'utf8'),
).version
const mermaidOutput = resolve(output, 'mermaid', mermaidVersion)
mkdirSync(mermaidOutput, { recursive: true })
cpSync(
  resolve(mermaidRoot, 'dist/mermaid.esm.min.mjs'),
  resolve(mermaidOutput, 'mermaid.esm.min.mjs'),
)
cpSync(
  resolve(mermaidRoot, 'dist/chunks/mermaid.esm.min'),
  resolve(mermaidOutput, 'chunks/mermaid.esm.min'),
  {
    recursive: true,
    filter: (path) => statSync(path).isDirectory() || path.endsWith('.mjs'),
  },
)
writeFileSync(
  resolve(generated, 'vendor-versions.json'),
  JSON.stringify({ mermaid: mermaidVersion }),
)
