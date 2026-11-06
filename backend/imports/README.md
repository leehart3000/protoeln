# Imports

Published records imported into ProtoELN, such as the write-ups of an open lab notebook on
Zenodo. Each folder is one import: a project and notebook of its own, with an entry for each
record.

- `plan.json`: the project and notebook (with credit for the data: its source, licence and how
  to cite it), and each record's title, kind, tags, address, DOI, authors, publication date,
  licence and citation, copied from the record's page.
- `content/ID.json`: each record's write-up, in ProtoELN's content format (protoeln-doc/1),
  converted from the record's Word file by `tools/docx_to_protoeln.py`. Its notes say what the
  conversion keeps and what it can't keep yet (images are replaced by a note linking to the
  record). The tests check that every file is in the content format.

## Credit

The person who runs an import is shown as each entry's author, as "Imported by". No account is
made in anyone else's name. Each entry credits the record's original authors by name, with a
link to the record, its DOI, publication date, licence and citation. Each entry gets a first
version, noting where it was imported from.

## Adding a record

1. Download the record's Word file from Zenodo.
2. Convert it, from the `backend` folder (needs [pandoc](https://pandoc.org) 3):

   ```sh
   python3 imports/tools/docx_to_protoeln.py RECORD.docx https://zenodo.org/records/ID > imports/harding/content/ID.json
   ```

3. Add the record's details to `plan.json`, from its Zenodo page.
4. Run `just check`, which checks the content.

## Importing

From the top folder of the repository:

The importer must have signed in to the site before. `--into` repeats the database's name from
the settings, so an import never goes into the wrong database. It writes to the database
directly, so it works while the site is read-only. Running it again adds only the records not
imported yet, and changes nothing already there.

```sh
pnpm --dir backend import-records imports/harding --as YOUR-ORCID-iD --into DATABASE
```

## Sources

- Rachel Harding and colleagues, Structural Genomics Consortium, University of Toronto:
  huntingtin structure-function open lab notebook, on Zenodo, under CC BY 4.0.
