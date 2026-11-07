#!/usr/bin/env python3
"""Converts a Word write-up (.docx) into ProtoELN's content format, protoeln-doc/1.

Used once per record when preparing an import folder (see docs/imports.md), which is kept with
the site it's for, outside the repository; importing doesn't need this script or pandoc.

    python3 tools/docx_to_protoeln.py WRITEUP.docx RECORD_URL FOLDER/files [--attach FILE ...] \
        > FOLDER/content/ID.json

With --attach, the record's other files (spreadsheets: .xlsx, .xls or .csv; PDFs; Word .docx;
ChemDraw .cdx or .cdxml) are saved in FOLDER/files too, unchanged, and offered for download at
the end of the write-up, under a heading "Files". Office files with macros are refused when
importing.

Images are saved in FOLDER/files, each named by its SHA-256 (its id in the content), and listed
in FOLDER/files/files.json with their type and size. Pictures in old Windows formats (EMF and
WMF), which browsers can't show, are drawn with LibreOffice at 300 dpi and saved as JPEG or
PNG, whichever is smaller; any cropping Word applies to a picture is applied too. Images get
no description (alt text) from Word unless it has one, so add descriptions to the content by
hand. Needs pandoc 3 (https://pandoc.org), LibreOffice, pdftoppm (Poppler) and Pillow.

What it keeps: headings, paragraphs, bold, italic, subscript, superscript, links, line breaks,
lists, tables and pictures. A paragraph of the write-up's own (not in a table or list) that is
only bold text, such as "Background:", becomes a heading, with its words unchanged. What it
can't keep: arrows and text boxes drawn over a picture in Word; and underlining, which the
content format doesn't have. The first paragraph is left out when it only repeats the record's
title. Merged table cells stay merged. Anything else it doesn't recognise stops the conversion,
rather than being dropped.
"""

import hashlib
import io
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageChops


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


def word_pictures(docx):
    # How Word shows each picture: its cropping (fractions of each side) and its description,
    # by the picture's file in the .docx (such as media/image1.emf)
    with zipfile.ZipFile(docx) as package:
        rels = package.read('word/_rels/document.xml.rels').decode()
        document = package.read('word/document.xml').decode()
    targets = dict(re.findall(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"', rels))
    pictures = {}
    for drawing in re.findall(r'<w:drawing>.*?</w:drawing>', document, re.S):
        embed = re.search(r'r:embed="([^"]+)"', drawing)
        if not embed or embed.group(1) not in targets:
            continue
        crop = {side: 0.0 for side in 'ltrb'}
        rect = re.search(r'<a:srcRect([^>]*)/>', drawing)
        for side, value in re.findall(r'\b([ltrb])="(-?\d+)"', rect.group(1) if rect else ''):
            crop[side] = int(value) / 100000
        descr = re.search(r'<wp:docPr [^>]*descr="([^"]*)"', drawing)
        pictures[targets[embed.group(1)]] = {'crop': crop, 'alt': descr.group(1) if descr else ''}
    return pictures


def trimmed_image(image):
    # Without the white margins around it, keeping a little space
    background = Image.new('RGB', image.size, (255, 255, 255))
    box = ImageChops.difference(image.convert('RGB'), background).getbbox()
    if box is None:
        return image
    pad = 12
    return image.crop((
        max(box[0] - pad, 0), max(box[1] - pad, 0),
        min(box[2] + pad, image.width), min(box[3] + pad, image.height),
    ))


def cropped(image, crop, box=None):
    left, top, right, bottom = box or (0, 0, image.width, image.height)
    width, height = right - left, bottom - top
    return image.crop((
        round(left + crop['l'] * width), round(top + crop['t'] * height),
        round(right - crop['r'] * width), round(bottom - crop['b'] * height),
    ))


def drawn_picture(path, crop):
    # An EMF or WMF picture, drawn by LibreOffice (as a PDF) at 300 dpi
    with tempfile.TemporaryDirectory() as folder:
        subprocess.run(
            ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', folder, str(path)],
            check=True, capture_output=True,
        )
        pdf = next(Path(folder).glob('*.pdf'))
        subprocess.run(['pdftoppm', '-r', '300', '-png', '-singlefile', str(pdf), f'{folder}/page'],
                       check=True, capture_output=True)
        page = Image.open(f'{folder}/page.png').convert('RGB')
        page.load()
    # The picture is somewhere on the page: Word's cropping is of the picture, not the page
    background = Image.new('RGB', page.size, (255, 255, 255))
    box = ImageChops.difference(page, background).getbbox()
    return trimmed_image(cropped(page, crop, box))


def saved_image(path, crop, folder):
    if path.suffix.lower() in ('.emf', '.wmf'):
        image = drawn_picture(path, crop)
    else:
        image = cropped(Image.open(path), crop)
    image = image.convert('RGB')
    encoded = {}
    for kind, options in (('png', {'optimize': True}), ('jpeg', {'quality': 88})):
        buffer = io.BytesIO()
        image.save(buffer, kind.upper(), **options)
        encoded[kind] = buffer.getvalue()
    kind = min(encoded, key=lambda name: len(encoded[name]))
    extension = 'jpg' if kind == 'jpeg' else 'png'
    return listed_file(folder, encoded[kind], extension, {
        'name': f'{path.stem}.{extension}',
        'contentType': f'image/{kind}',
        'width': image.width,
        'height': image.height,
    })


# The kinds of file that can be offered for download (as in backend/src/data/models/file.ts)
DOWNLOADS = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.cdx': 'chemical/x-cdx',
    '.cdxml': 'chemical/x-cdxml',
}


def listed_file(folder, body, extension, details):
    # Saves a file in the files folder, named by its SHA-256, and lists it in files.json
    sha256 = hashlib.sha256(body).hexdigest()
    (folder / f'{sha256}.{extension}').write_bytes(body)
    listed = folder / 'files.json'
    files = json.loads(listed.read_text()) if listed.exists() else {}
    files[sha256] = details
    listed.write_text(json.dumps(files, indent=2, sort_keys=True) + '\n')
    return sha256


def attachment_blocks(paths, folder):
    # The record's other files, unchanged, for download at the end of the write-up
    if not paths:
        return []
    blocks = [{'type': 'heading', 'attrs': {'level': 2}, 'content': [{'type': 'text', 'text': 'Files'}]}]
    for path in map(Path, paths):
        content_type = DOWNLOADS.get(path.suffix.lower())
        if content_type is None:
            sys.exit(f'{path}: only {", ".join(DOWNLOADS)} files can be attached')
        sha256 = listed_file(folder, path.read_bytes(), path.suffix.lower()[1:], {
            'name': path.name, 'contentType': content_type,
        })
        blocks.append({'type': 'fileBlock', 'attrs': {'fileId': sha256}})
    return blocks


def file_block(item, context):
    source = Path(item['c'][2][0])
    picture = context['pictures'].get(f'media/{source.name}', {'crop': {s: 0.0 for s in 'ltrb'}, 'alt': ''})
    sha256 = saved_image(source, picture['crop'], context['folder'])
    attrs = {'fileId': sha256}
    if picture['alt']:
        attrs['alt'] = picture['alt']
    return {'type': 'fileBlock', 'attrs': attrs}


def cell_blocks(blocks, context):
    converted = convert_blocks(blocks, context)
    return converted or [{'type': 'paragraph'}]


def table(item, context):
    _attr, _caption, _specs, head, bodies, foot = item['c']
    rows = []

    def add(row, header):
        cells = []
        for cell in row[1]:
            _cell_attr, _align, row_span, col_span, blocks = cell
            node = {'type': 'tableHeader' if header else 'tableCell'}
            # A merged cell keeps its span; the cells it covers aren't listed, as in the format
            span = {key: value for key, value in (('colspan', col_span), ('rowspan', row_span))
                    if value != 1}
            if span:
                node['attrs'] = span
            node['content'] = cell_blocks(blocks, context)
            cells.append(node)
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


def convert_blocks(blocks, context, top=False):
    out = []
    for item in blocks:
        kind = item['t']
        if kind in ('Para', 'Plain'):
            if any(child['t'] == 'Image' for child in item['c']):
                # Pictures become blocks of their own, in their place among the paragraph's text
                text = []
                for child in item['c']:
                    if child['t'] == 'Image':
                        if paragraph(text).get('content'):
                            out.append(paragraph(text))
                        text = []
                        out.append(file_block(child, context))
                    else:
                        text.append(child)
                if paragraph(text).get('content'):
                    out.append(paragraph(text))
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
                {'type': 'listItem', 'content': cell_blocks(entry, context)} for entry in item['c']
            ]})
        elif kind == 'OrderedList':
            start = item['c'][0][0]
            node = {'type': 'orderedList', 'content': [
                {'type': 'listItem', 'content': cell_blocks(entry, context)} for entry in item['c'][1]
            ]}
            if start != 1:
                node['attrs'] = {'start': start}
            out.append(node)
        elif kind == 'BlockQuote':
            out.append({'type': 'blockquote', 'content': cell_blocks(item['c'], context)})
        elif kind == 'CodeBlock':
            out.append({'type': 'codeBlock', 'content': [{'type': 'text', 'text': item['c'][1]}]})
        elif kind == 'Table':
            out.append(table(item, context))
        elif kind == 'Div':
            out += convert_blocks(item['c'][1], context)
        elif kind == 'HorizontalRule':
            continue
        else:
            raise Unsupported(f'block {kind}')
    # Empty paragraphs used for spacing in Word aren't kept
    return [node for node in out if node != {'type': 'paragraph'}]


def main():
    arguments = sys.argv[1:]
    attach = []
    if '--attach' in arguments:
        at = arguments.index('--attach')
        arguments, attach = arguments[:at], arguments[at + 1:]
    if len(arguments) != 3:
        sys.exit(__doc__)
    docx, record_url, files_folder = arguments
    folder = Path(files_folder)
    folder.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as media:
        ast = json.loads(subprocess.run(
            ['pandoc', '--from', 'docx', '--to', 'json', f'--extract-media={media}', docx],
            check=True, capture_output=True, text=True,
        ).stdout)
        context = {'pictures': word_pictures(docx), 'folder': folder, 'record_url': record_url}
        try:
            content = convert_blocks(ast['blocks'], context, top=True)
        except Unsupported as problem:
            sys.exit(f'{docx}: has something the converter can’t keep: {problem}')
    # The first paragraph is the record's title, which the entry has already
    if content and content[0]['type'] == 'heading':
        content = content[1:]
    content += attachment_blocks(attach, folder)
    json.dump({'type': 'doc', 'content': content}, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == '__main__':
    main()
