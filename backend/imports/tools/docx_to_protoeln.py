#!/usr/bin/env python3
"""Converts a Word write-up (.docx) into ProtoELN's content format, protoeln-doc/1.

Used once per record when preparing an import (see imports/README.md); the result is committed,
so importing doesn't need this script or pandoc. Needs pandoc 3 (https://pandoc.org).

    python3 imports/tools/docx_to_protoeln.py WRITEUP.docx RECORD_URL > content/RECORD.json

What it keeps: headings, paragraphs, bold, italic, subscript, superscript, links, line breaks,
lists and tables. A paragraph of the write-up's own (not in a table or list) that is only bold
text, such as "Background:", becomes a heading, with its words unchanged. What it can't keep
yet: images (ProtoELN can't store files yet), so each is replaced by a note linking to the
original record; and underlining, which the content format doesn't have. The first paragraph
is left out when it only repeats the record's title. Anything else it doesn't recognise stops
the conversion, rather than being dropped.
"""

import json
import subprocess
import sys


class Unsupported(Exception):
    pass


def text_node(text, marks):
    node = {'type': 'text', 'text': text}
    if marks:
        node['marks'] = [dict(mark) for mark in marks]
    return node


def inlines(items, marks=()):
    out = []
    for item in items:
        kind = item['t']
        if kind == 'Str':
            out.append(text_node(item['c'], marks))
        elif kind in ('Space', 'SoftBreak'):
            out.append(text_node(' ', marks))
        elif kind == 'LineBreak':
            out.append({'type': 'hardBreak'})
        elif kind == 'Strong':
            out += inlines(item['c'], (*marks, {'type': 'bold'}))
        elif kind == 'Emph':
            out += inlines(item['c'], (*marks, {'type': 'italic'}))
        elif kind == 'Superscript':
            out += inlines(item['c'], (*marks, {'type': 'superscript'}))
        elif kind == 'Subscript':
            out += inlines(item['c'], (*marks, {'type': 'subscript'}))
        elif kind == 'Code':
            out.append(text_node(item['c'][1], (*marks, {'type': 'code'})))
        elif kind in ('Underline', 'SmallCaps', 'Span'):
            # No underlining or small capitals in the content format: the words are kept
            out += inlines(item['c'] if kind != 'Span' else item['c'][1], marks)
        elif kind == 'Link':
            href = item['c'][2][0]
            out += inlines(item['c'][1], (*marks, {'type': 'link', 'attrs': {'href': href}}))
        elif kind == 'Quoted':
            quote = '“”' if item['c'][0]['t'] == 'DoubleQuote' else '‘’'
            out += [text_node(quote[0], marks), *inlines(item['c'][1], marks)]
            out.append(text_node(quote[1], marks))
        elif kind == 'Image':
            raise Unsupported('image')  # handled by the paragraph that holds it
        else:
            raise Unsupported(f'inline {kind}')
    return merge(out)


def merge(nodes):
    # Joins neighbouring text with the same marks, as an editor would store it
    out = []
    for node in nodes:
        last = out[-1] if out else None
        if (
            last
            and node['type'] == 'text'
            and last['type'] == 'text'
            and last.get('marks') == node.get('marks')
        ):
            last['text'] += node['text']
        else:
            out.append(node)
    return out


def trimmed(nodes):
    # Leading and trailing spaces in a paragraph aren't shown, so they're left out
    while nodes and nodes[0]['type'] == 'text' and not nodes[0]['text'].strip():
        nodes = nodes[1:]
    while nodes and nodes[-1]['type'] == 'text' and not nodes[-1]['text'].strip():
        nodes = nodes[:-1]
    if nodes and nodes[0]['type'] == 'text':
        nodes[0] = {**nodes[0], 'text': nodes[0]['text'].lstrip()}
    if nodes and nodes[-1]['type'] == 'text':
        nodes[-1] = {**nodes[-1], 'text': nodes[-1]['text'].rstrip()}
    return nodes


def paragraph(items):
    content = trimmed(inlines(items))
    return {'type': 'paragraph', 'content': content} if content else {'type': 'paragraph'}


def all_bold(node):
    content = node.get('content', [])
    return bool(content) and all(
        child['type'] == 'text' and {'type': 'bold'} in child.get('marks', [])
        for child in content
    )


def without_bold(content):
    out = []
    for child in content:
        marks = [mark for mark in child.get('marks', []) if mark != {'type': 'bold'}]
        out.append(text_node(child['text'], marks))
    return merge(out)


def image_note(record_url):
    return {
        'type': 'paragraph',
        'content': [
            text_node('[Figure not imported: ProtoELN can’t store images yet. See it in ', [
                {'type': 'italic'},
            ]),
            text_node('the original record', [
                {'type': 'italic'},
                {'type': 'link', 'attrs': {'href': record_url}},
            ]),
            text_node('.]', [{'type': 'italic'}]),
        ],
    }


def cell_blocks(blocks, record_url):
    converted = convert_blocks(blocks, record_url)
    return converted or [{'type': 'paragraph'}]


def table(item, record_url):
    _attr, _caption, _specs, head, bodies, foot = item['c']
    rows = []

    def add(row, header):
        cells = []
        for cell in row[1]:
            _cell_attr, _align, row_span, col_span, blocks = cell
            if row_span != 1 or col_span != 1:
                raise Unsupported('merged table cells')
            cells.append({
                'type': 'tableHeader' if header else 'tableCell',
                'content': cell_blocks(blocks, record_url),
            })
        rows.append({'type': 'tableRow', 'content': cells})

    for row in head[1]:
        add(row, True)
    for body in bodies:
        _body_attr, _row_head_columns, body_head, body_rows = body
        for row in body_head:
            add(row, True)
        for row in body_rows:
            add(row, False)
    if foot[1]:
        raise Unsupported('table footer')
    return {'type': 'table', 'content': rows}


def convert_blocks(blocks, record_url, top=False):
    out = []
    for item in blocks:
        kind = item['t']
        if kind in ('Para', 'Plain'):
            if any(child['t'] == 'Image' for child in item['c']):
                rest = [child for child in item['c'] if child['t'] not in ('Image', 'Space', 'SoftBreak')]
                if rest:
                    out.append(paragraph(item['c'][:0] + rest))
                out.append(image_note(record_url))
                continue
            node = paragraph(item['c'])
            if top and all_bold(node):
                node = {'type': 'heading', 'attrs': {'level': 2}, 'content': without_bold(node['content'])}
            out.append(node)
        elif kind == 'Header':
            level = min(max(item['c'][0], 1), 3)
            out.append({'type': 'heading', 'attrs': {'level': level}, 'content': trimmed(inlines(item['c'][2]))})
        elif kind == 'BulletList':
            out.append({'type': 'bulletList', 'content': [
                {'type': 'listItem', 'content': cell_blocks(entry, record_url)} for entry in item['c']
            ]})
        elif kind == 'OrderedList':
            start = item['c'][0][0]
            node = {'type': 'orderedList', 'content': [
                {'type': 'listItem', 'content': cell_blocks(entry, record_url)} for entry in item['c'][1]
            ]}
            if start != 1:
                node['attrs'] = {'start': start}
            out.append(node)
        elif kind == 'BlockQuote':
            out.append({'type': 'blockquote', 'content': cell_blocks(item['c'], record_url)})
        elif kind == 'CodeBlock':
            out.append({'type': 'codeBlock', 'content': [{'type': 'text', 'text': item['c'][1]}]})
        elif kind == 'Table':
            out.append(table(item, record_url))
        elif kind == 'Div':
            out += convert_blocks(item['c'][1], record_url)
        elif kind == 'HorizontalRule':
            continue
        else:
            raise Unsupported(f'block {kind}')
    # Empty paragraphs used for spacing in Word aren't kept
    return [node for node in out if node != {'type': 'paragraph'}]


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    docx, record_url = sys.argv[1:]
    ast = json.loads(subprocess.run(
        ['pandoc', '--from', 'docx', '--to', 'json', docx],
        check=True, capture_output=True, text=True,
    ).stdout)
    try:
        content = convert_blocks(ast['blocks'], record_url, top=True)
    except Unsupported as problem:
        sys.exit(f'{docx}: has something the converter can’t keep: {problem}')
    # The first paragraph is the record's title, which the entry has already
    if content and content[0]['type'] == 'heading':
        content = content[1:]
    json.dump({'type': 'doc', 'content': content}, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == '__main__':
    main()
