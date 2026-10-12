import type { DynamicImportLanguageRegistration } from 'shiki/core'
import { createBundledHighlighter, createSingletonShorthands } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

import manifest from './generated/shiki-languages.json'

export const bundledLanguagesInfo = manifest.languages.map((language) => ({
  ...language,
  import: (() => {
    const url = `/vendor/shiki/${manifest.version}/langs/${language.id}.mjs`
    return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)
  }) as DynamicImportLanguageRegistration,
}))

export const bundledLanguages: Record<
  string,
  DynamicImportLanguageRegistration
> = {}
for (const language of bundledLanguagesInfo) {
  for (const key of [language.id, ...(language.aliases ?? [])]) {
    bundledLanguages[key] = language.import
  }
}

export const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: {
    'github-light': () => Promise.resolve(githubLight),
    'github-dark': () => Promise.resolve(githubDark),
  },
  engine: () => createOnigurumaEngine(import('shiki/wasm')),
})

export const { codeToHtml, codeToHast, codeToTokens, getSingletonHighlighter } =
  createSingletonShorthands(createHighlighter)
