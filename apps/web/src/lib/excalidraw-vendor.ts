import type * as ExcalidrawApi from '@excalidraw/excalidraw'
import * as React from 'react'
import * as JSXRuntime from 'react/jsx-runtime'
import * as ReactDOM from 'react-dom'

import version from './generated/excalidraw-version.json'

/* eslint-disable antfu/no-top-level-await -- Load the separately bundled browser dependency. */

const base = `/vendor/excalidraw/${version.fingerprint}`
let api: typeof ExcalidrawApi | undefined
if (typeof window !== 'undefined') {
  // Share the application's React instance so hooks work across the vendor boundary.
  Object.assign(globalThis, {
    __SHIRO_VENDOR_REACT__: {
      react: React,
      'react-dom': ReactDOM,
      'react/jsx-runtime': JSXRuntime,
    },
    EXCALIDRAW_ASSET_PATH: `${base}/`,
  })
  if (!document.querySelector('link[data-shiro-excalidraw]')) {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = `${base}/index.css`
    stylesheet.dataset.shiroExcalidraw = ''
    document.head.append(stylesheet)
  }
  const url = `${base}/index.mjs`
  api = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)
}

export const Excalidraw = api?.Excalidraw as typeof ExcalidrawApi.Excalidraw
export const exportToBlob =
  api?.exportToBlob as typeof ExcalidrawApi.exportToBlob
