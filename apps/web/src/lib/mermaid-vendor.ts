import type mermaid from 'mermaid'

import versions from './generated/vendor-versions.json'

/* eslint-disable antfu/no-top-level-await -- Preserve the browser ESM API while loading its precompiled module. */

// Mermaid publishes a complete browser ESM distribution. Load it only in the
// browser, preserving its API without rebuilding every diagram implementation.
const url = `/vendor/mermaid/${versions.mermaid}/mermaid.esm.min.mjs`
const module =
  typeof window === 'undefined'
    ? null
    : await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)

export default module?.default as typeof mermaid
