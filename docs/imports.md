# Imports

Published records can be imported into ProtoELN, such as the write-ups of an open lab notebook
on Zenodo. Each import goes into a project and notebook of its own, with an entry for each
record. protoeln.org's demo imports Rachel Harding's huntingtin notebook this way.

An import's data isn't part of ProtoELN, so it isn't kept in this repository: each site keeps
its own import folders alongside it (for protoeln.org, in `../protoeln_resources/imports/`).
This repository has the tools: the import command, a check, and a converter for Word files.

## An import folder

- `plan.json`: the project and notebook (with credit for the data: its source, licence and how
  to cite it), and each record's `id`, title, kind, tags, address, DOI, authors, publication
  date, licence and citation, copied from the record's page, and what the import changed
  (licences such as CC BY 4.0 ask for any changes to be stated).
- `content/ID.json`: each record's write-up, in ProtoELN's content format (protoeln-doc/1).
- `files/`: the images the write-ups show, each named by its SHA-256 (with `.png`, `.jpg`,
  `.gif` or `.webp`), and listed in `files/files.json` with its type, name and size in pixels.

## Credit

The person who runs an import is shown as each entry's author, as "Imported by". No account is
made in anyone else's name. Each entry credits the record's original authors by name, with a
link to the record, its DOI, publication date, licence, citation, and what was changed. A
project of imported records should also say that it isn't connected with, or endorsed by, the
authors (as CC BY 4.0 asks). Each entry gets a first version, noting where it was imported from.

## Adding a record from a Word file

1. Download the record's Word file.
2. Convert it, from the `backend` folder (needs [pandoc](https://pandoc.org) 3, LibreOffice,
   Poppler's `pdftoppm` and Python's Pillow):

   ```sh
   python3 tools/docx_to_protoeln.py RECORD.docx https://zenodo.org/records/ID FOLDER/files > FOLDER/content/ID.json
   ```

   The converter's notes say what it keeps and what it can't. Pictures in old Windows formats
   (EMF) are drawn as JPEG or PNG, with Word's cropping applied. Merged table cells are split,
   with their text in the first cell, and the converter says so (the record's changes should
   too).

3. Describe each image in the content (`alt`), and add a caption if something in the original
   can't be shown.
4. Add the record's details to `plan.json`, from its page.
5. Check the folder (below).

## Checking

The check reads the folder without connecting to any database. It finds content that isn't in
the content format, images that are missing, don't match their names or aren't an allowed
type, and images with no description:

```sh
pnpm --dir backend check-import FOLDER
```

## Importing

The importer must have signed in to the site before, and the site's file store must be set up
(the `PROTOELN_FILES_` settings) for records with images. `--into` repeats the database's name
from the settings, so an import never goes into the wrong database. The import checks the
folder first, and stops if anything is wrong. It writes to the database directly, so it works
while the site is read-only. Running it again adds only the records not imported yet, and
changes nothing already there.

```sh
pnpm --dir backend import-records FOLDER --as YOUR-ORCID-iD --into DATABASE
```

To import into another site's database (such as staging), put that site's settings in a file
such as `backend/.env.staging` (git ignores it) and run, from the `backend` folder:

```sh
node --env-file=.env.staging src/import-records.ts FOLDER --as YOUR-ORCID-iD --into DATABASE
```
