'use client'

import { NestedContentRendererProvider } from '@haklex/rich-editor/static'
import { chatNodes } from '@haklex/rich-ext-chat/node'
import { codeSnippetNodes } from '@haklex/rich-ext-code-snippet/node'
import { embedNodes } from '@haklex/rich-ext-embed/static'
import { ExcalidrawNode } from '@haklex/rich-ext-excalidraw/static'
import { galleryNodes } from '@haklex/rich-ext-gallery/node'
import { nestedDocNodes } from '@haklex/rich-ext-nested-doc/static'
import { pollNodes } from '@haklex/rich-ext-poll/node'
import type { RichRendererProps } from '@haklex/rich-static-renderer'
import { RichRenderer } from '@haklex/rich-static-renderer'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useSyncExternalStore } from 'react'

// Import individual static entry points; the old kit pulled editing plugins
// and the entire renderer barrel into every consuming route.
const renderers = {
  Alert: dynamic(() =>
    import('@haklex/rich-renderer-alert/static').then((m) => m.AlertRenderer),
  ),
  Banner: dynamic(() =>
    import('@haklex/rich-renderer-banner/static').then((m) => m.BannerRenderer),
  ),
  CodeBlock: dynamic(() =>
    import('@haklex/rich-renderer-codeblock/static').then(
      (m) => m.CodeBlockRenderer,
    ),
  ),
  Image: dynamic(() =>
    import('@haklex/rich-renderer-image/static').then((m) => m.ImageRenderer),
  ),
  KaTeX: dynamic(() =>
    import('@haklex/rich-editor/renderers').then((m) => m.KaTeXRenderer),
  ),
  Mention: dynamic(() =>
    import('@haklex/rich-renderer-mention/static').then(
      (m) => m.MentionRenderer,
    ),
  ),
  Mermaid: dynamic(() =>
    import('@haklex/rich-renderer-mermaid/static').then(
      (m) => m.MermaidRenderer,
    ),
  ),
  Video: dynamic(() =>
    import('@haklex/rich-renderer-video/static').then((m) => m.VideoRenderer),
  ),
  Chat: dynamic(() =>
    import('@haklex/rich-ext-chat/renderer').then((m) => m.ChatRenderer),
  ),
  CodeSnippet: dynamic(() =>
    import('@haklex/rich-ext-code-snippet/renderer').then(
      (m) => m.CodeSnippetRenderer,
    ),
  ),
  Gallery: dynamic(() =>
    import('@haklex/rich-ext-gallery/renderer').then((m) => m.GalleryRenderer),
  ),
}
const extraNodes = [
  ExcalidrawNode,
  ...embedNodes,
  ...galleryNodes,
  ...codeSnippetNodes,
  ...chatNodes,
  ...nestedDocNodes,
  ...pollNodes,
]
const DialogStack = dynamic(
  () => import('@haklex/rich-editor-ui').then((m) => m.DialogStackProvider),
  { ssr: false },
)
const hosts = new Set<string>()
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const getHost = () => hosts.values().next().value ?? null

function RichDialogHost() {
  const id = useId()
  const host = useSyncExternalStore(subscribe, getHost, () => null)
  useEffect(() => {
    hosts.add(id)
    notify()
    return () => {
      hosts.delete(id)
      notify()
    }
  }, [id])
  return host === id ? <DialogStack /> : null
}

export function CmsRichRenderer({
  rendererConfig,
  ...props
}: RichRendererProps) {
  const renderNested = useCallback(
    (
      value: RichRendererProps['value'],
      variant?: RichRendererProps['variant'],
    ) => (
      <CmsRichRenderer
        nested
        value={value}
        variant={variant ?? props.variant}
        theme={props.theme}
        rendererConfig={rendererConfig}
      />
    ),
    [props.theme, props.variant, rendererConfig],
  )
  return (
    <NestedContentRendererProvider value={renderNested}>
      <RichRenderer
        {...props}
        extraNodes={extraNodes}
        rendererConfig={{ ...renderers, ...rendererConfig }}
      />
      {!props.nested && <RichDialogHost />}
    </NestedContentRendererProvider>
  )
}
