import type { InlineNode, Mark } from '@protoeln/content'
import { h, type FunctionalComponent, type VNode } from 'vue'

import { textLink } from './styles'

// Shows the text inside a block of entry content, with its marks (bold, links and so on). See
// ContentBlocks.vue for the blocks themselves.

// Only web and email links are made clickable, so content can't run script through a link
export function isSafeHref(href: string) {
  return /^(https?:|mailto:)/i.test(href)
}

function wrap(mark: Mark, child: string | VNode): string | VNode {
  switch (mark.type) {
    case 'bold':
      return h('strong', [child])
    case 'italic':
      return h('em', [child])
    case 'code':
      return h('code', { class: 'font-mono text-[0.9em]' }, [child])
    case 'subscript':
      return h('sub', [child])
    case 'superscript':
      return h('sup', [child])
    case 'link':
      return isSafeHref(mark.attrs.href)
        ? h('a', { href: mark.attrs.href, class: textLink }, [child])
        : child
  }
}

export const InlineContent: FunctionalComponent<{ nodes: InlineNode[] }> = (props) =>
  props.nodes.map((node) =>
    node.type === 'hardBreak'
      ? h('br')
      : (node.marks ?? []).reduceRight<string | VNode>(
          (child, mark) => wrap(mark, child),
          node.text,
        ),
  )
InlineContent.props = ['nodes']
