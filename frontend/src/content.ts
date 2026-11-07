import type { InlineNode, Mark } from '@protoeln/content'
import { h, type FunctionalComponent, type VNode } from 'vue'

import { ExternalIcon } from './icons'
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
    case 'highlight':
      return h('mark', [child])
    case 'link':
      if (!isSafeHref(mark.attrs.href)) return child
      // Web links open in a new tab, so readers keep their place in the entry (as elsewhere on
      // the site, with the same icon and words for screen readers); email links don't
      return /^mailto:/i.test(mark.attrs.href)
        ? h('a', { href: mark.attrs.href, class: textLink }, [child])
        : h(
            'a',
            {
              href: mark.attrs.href,
              class: textLink,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            [
              child,
              h(ExternalIcon, {
                'aria-hidden': 'true',
                class: 'ml-0.5 inline size-3.5 align-baseline',
              }),
              h('span', { class: 'sr-only' }, ' (opens in a new tab)'),
            ],
          )
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
