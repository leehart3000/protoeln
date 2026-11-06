# Imports

Published records imported into ProtoELN, such as the write-ups of an open lab notebook on
Zenodo. Each folder is one import: a project and notebook of its own, with an entry for each
record.

- `plan.json`: the project and notebook (with credit for the data: its source, licence and how
  to cite it), and each record's title, kind, tags, address, DOI, authors, publication date,
  licence and citation, copied from the record's page, and what the import changed (CC BY 4.0
  asks for any changes to be stated).
- `content/ID.json`: each record's write-up, in ProtoELN's content format (protoeln-doc/1),
  converted from the record's Word file by `tools/docx_to_protoeln.py`. Its notes say what the
  conversion keeps and what it can't. Each image's description (alt text) and any caption are
  added by hand. The tests check that every file is in the content format, and that every
  image is described.
- `files/`: the images the write-ups show, each named by its SHA-256, and listed in
  `files/files.json` with its type and size in pixels. Pictures in old Windows formats (EMF)
  are drawn as JPEG or PNG, with Word's cropping applied. The import keeps them in the site's
  file store (see "Files" in docs/deployment.md) before adding any entry that shows them.

## Credit

The person who runs an import is shown as each entry's author, as "Imported by". No account is
made in anyone else's name. Each entry credits the record's original authors by name, with a
link to the record, its DOI, publication date, licence, citation, and what was changed. The
project says it isn't connected with, or endorsed by, the authors (as CC BY 4.0 asks). Each entry gets a first
version, noting where it was imported from.

## Adding a record

1. Download the record's Word file from Zenodo.
2. Convert it, from the `backend` folder (needs [pandoc](https://pandoc.org) 3, LibreOffice,
   Poppler's `pdftoppm` and Python's Pillow):

   ```sh
   python3 imports/tools/docx_to_protoeln.py RECORD.docx https://zenodo.org/records/ID imports/harding/files > imports/harding/content/ID.json
   ```

3. Describe each image in the content (`alt`), and add a caption if something in the original
   can't be shown.
4. Add the record's details to `plan.json`, from its Zenodo page.
5. Run `just check`, which checks the content and images.

## Importing

From the top folder of the repository:

The importer must have signed in to the site before, and the site's file store must be set up
(the `PROTOELN_FILES_` settings) for records with images. `--into` repeats the database's name from
the settings, so an import never goes into the wrong database. It writes to the database
directly, so it works while the site is read-only. Running it again adds only the records not
imported yet, and changes nothing already there.

```sh
pnpm --dir backend import-records imports/harding --as YOUR-ORCID-iD --into DATABASE
```

## Sources

- Rachel Harding and colleagues, Structural Genomics Consortium, University of Toronto:
  huntingtin structure-function open lab notebook, on Zenodo, under CC BY 4.0.
