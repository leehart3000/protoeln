#!/usr/bin/env python3
"""Converts the pages of a LabArchives notebook export (its offline HTML version) into ProtoELN's
content format, protoeln-doc/1, for an import folder (see docs/imports.md).

Used once per export when preparing an import folder, which is kept with the site it's for,
outside the repository; importing doesn't need this script or pandoc.

    python3 tools/labarchives_to_protoeln.py EXPORT_FOLDER IMPORT_FOLDER [--alt ALT.json] \
        > pages.json

EXPORT_FOLDER is the unzipped export, with a page per numbered HTML file (1.html, 2.html …)
and the attached files in attachments/original. For each page, the write-up is saved as
IMPORT_FOLDER/content/TITLE.json (TITLE being the page's name, such as DMK171-1), and its
files in IMPORT_FOLDER/files, each named by its SHA-256 and listed in files/files.json. The
pages are listed on standard output, in order, with their titles, who made them and when, to
copy into plan.json.

A page's parts are kept in order. Rich text keeps paragraphs, bold, italic, subscript,
superscript, links, line breaks, lists and tables; a paragraph that is only bold text, such as
"Procedure", becomes a heading. Coloured (other than black or grey) and highlighted text is
highlighted, as the content format has no colours. Attached pictures (PNG, JPEG, GIF or WebP)
are shown in place; other attached files (PDF, Word, ChemDraw, spreadsheets) are offered for download,
unchanged, under a heading "Files" when they follow text. ALT.json gives each picture's
description (alt text), by its file name in attachments/original (such as 3-DMK171-1.jpg), as
pictures get none from LabArchives.
Any other kind of part, or anything in the rich text it doesn't recognise, stops the
conversion, rather than being dropped. Needs pandoc 3 (https://pandoc.org).
"""

import base64
import html
import io
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

from docx_to_protoeln import DOWNLOADS, Unsupported, convert_blocks, listed_file

IMAGES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
          '.webp': 'image/webp'}
EXTENSIONS = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp'}

# LabArchives' kinds of page part (EPT_* in its pages)
RICH_TEXT, ATTACHMENT = '1', '2'


def decoded(encoded):
    return json.loads(base64.b64decode(encoded))


def page_parts(page):
    # The page's parts, in order: each part's details are in a dispatchSetEntry call, and rich
    # text in the section that follows it
    details = {
        number: decoded(encoded)
        for number, encoded in re.findall(
            r'dispatchSetEntry\("(\d+)", decodeBase64AndParseJSON\("([^"]*)"\)', page)
    }
    for kind, number in re.findall(r'createAndRegisterLAEntryPartComponent\((\d+), (\d+)\)', page):
        part = {'kind': kind, **details[number]}
        if kind == RICH_TEXT and part.get('data'):
            # Written in LabArchives' newer editor, which keeps the text in the part's details
            part['html'] = part['data']
        elif kind == RICH_TEXT:
            found = re.search(
                rf'<section aria-owns="epc_{number}" class="ep_rich_text[^"]*" id="ept_{number}">'
                r'(.*?)</section>', page, re.S)
            part['html'] = found.group(1)
        yield part


def no_trailing_breaks(blocks):
    # A line break at the end of a paragraph isn't shown, so it's left out
    for block in blocks:
        if block['type'] == 'paragraph':
            content = block.get('content', [])
            while content and content[-1]['type'] == 'hardBreak':
                content.pop()
            if not content:
                block.pop('content', None)
        if 'content' in block and block['type'] != 'paragraph':
            block['content'] = no_trailing_breaks(block['content']) or [{'type': 'paragraph'}]
    return [block for block in blocks if block != {'type': 'paragraph'}]


def rich_text(fragment):
    # Non-breaking spaces, which LabArchives' editor scatters between words, read as spaces
    fragment = fragment.replace('&nbsp;', ' ')
    ast = json.loads(subprocess.run(
        ['pandoc', '--from', 'html', '--to', 'json'],
        input=fragment, check=True, capture_output=True, text=True,
    ).stdout)
    return no_trailing_breaks(convert_blocks(ast['blocks'], {}, top=True))


def attachment(part, export, files, alts):
    name = part['filename']
    extension = Path(name).suffix.lower()
    urls = part['urls'] if isinstance(part['urls'], dict) else json.loads(part['urls'])
    path = export / urls['urlLink']
    body = path.read_bytes()
    if extension in IMAGES:
        alt = alts.get(path.name)
        if not alt:
            print(f'{path.name}: no description in ALT.json yet', file=sys.stderr)
        content_type = IMAGES[extension]
        with Image.open(io.BytesIO(body)) as image:
            width, height = image.size
        sha256 = listed_file(files, body, EXTENSIONS[content_type], {
            'name': name, 'contentType': content_type, 'width': width, 'height': height,
        })
        attrs = {'fileId': sha256}
        if alt:
            attrs['alt'] = alt
        return {'type': 'fileBlock', 'attrs': attrs}, True
    content_type = DOWNLOADS.get(extension)
    if content_type is None:
        raise Unsupported(f'an attached {extension} file ({name})')
    sha256 = listed_file(files, body, extension[1:], {'name': name, 'contentType': content_type})
    return {'type': 'fileBlock', 'attrs': {'fileId': sha256}}, False


def convert_page(path, export, files, alts):
    page = path.read_text()
    title = html.unescape(re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S).group(1).strip())
    made = re.search(r'created by (.+?) on (\d{4}-\d{2}-\d{2})', page)
    content = []
    after_text = False
    for part in page_parts(page):
        if part['kind'] == RICH_TEXT:
            content += rich_text(part['html'])
            after_text = True
        elif part['kind'] == ATTACHMENT:
            block, is_image = attachment(part, export, files, alts)
            if not is_image and after_text:
                content.append({'type': 'heading', 'attrs': {'level': 2},
                                'content': [{'type': 'text', 'text': 'Files'}]})
            if not is_image:
                after_text = False
            content.append(block)
        else:
            raise Unsupported(f'a part of kind {part["kind"]}')
    updated = max(
        (part['updatedAt'] for part in page_parts(page) if part.get('updatedAt')), default=None)
    return title, {'type': 'doc', 'content': content}, {
        'title': title, 'createdBy': made.group(1), 'createdOn': made.group(2),
        'lastChanged': updated[:10] if updated else None,
    }


def main():
    arguments = sys.argv[1:]
    alts = {}
    if '--alt' in arguments:
        at = arguments.index('--alt')
        listed = Path(arguments[at + 1])
        # Until there are descriptions, there may be no file yet
        alts = json.loads(listed.read_text()) if listed.exists() else {}
        arguments = arguments[:at] + arguments[at + 2:]
    if len(arguments) != 2:
        sys.exit(__doc__)
    export, folder = map(Path, arguments)
    (folder / 'content').mkdir(parents=True, exist_ok=True)
    files = folder / 'files'
    files.mkdir(exist_ok=True)
    pages = sorted(export.glob('[0-9]*.html'), key=lambda path: int(path.stem))
    listed = []
    for path in pages:
        try:
            title, content, details = convert_page(path, export, files, alts)
        except Unsupported as problem:
            sys.exit(f'{path}: has something the converter can’t keep: {problem}')
        (folder / 'content' / f'{title}.json').write_text(
            json.dumps(content, ensure_ascii=False, indent=2) + '\n')
        listed.append(details)
    json.dump(listed, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == '__main__':
    main()
